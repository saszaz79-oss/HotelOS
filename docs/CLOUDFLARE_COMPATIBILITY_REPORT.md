# HotelOS — Cloudflare Workers Deployment Compatibility Report

**Date**: 2026-07-18. **Method**: every finding below was either verified directly in this environment (Node.js/npm available, no live Cloudflare/Supabase account) or is explicitly marked unverified. Per the Constitution's "Never Hide Uncertainty" rule, this report does not round up — "compiles" is not the same claim as "works in production," and this document is careful about which one it's making.

## Summary

HotelOS **can** run on Cloudflare Workers via `@opennextjs/cloudflare`, but not as originally built. Three genuine incompatibilities were found and fixed; the fixes are verified up to "produces a real Worker bundle" — **not** verified against a live deployment, since no Cloudflare/Supabase account is available in this environment. See "What Has Not Been Verified" before trusting this in production.

## Compatible Features (verified)

- **Next.js App Router, Server Actions, Server Components, middleware** — all standard OpenNext-supported patterns; no changes needed beyond the framework version bump below.
- **Bilingual Arabic/English RTL/LTR routing** — pure Next.js routing/rendering, no Workers-specific concern.
- **Authentication** (bcryptjs, `node:crypto` `randomBytes`/`createHash`/`randomUUID`, database-backed sessions via `next/headers` `cookies()`) — `node:crypto` functions used are all covered by Cloudflare's `nodejs_compat` flag; `cookies()` works natively under OpenNext. Verified: `tsc` clean, full `next build` clean, and the async-cookies migration (Next.js 15 requirement) applied via the official codemod.
- **Multi-tenant hotel-scoping, RBAC, audit logging** — pure application logic, no runtime dependency.
- **The in-process Domain Event Bus** — works, with a precise caveat: "in-process" now means "per Workers isolate," not "per server process." Cloudflare may run multiple isolates concurrently across edge locations, each with its own independent subscriber registry — this does not break correctness (publish/subscribe still happens synchronously within one request's execution in the same isolate that registered the subscribers via the side-effect imports already in place), but it means the bus is not, and was never claimed to be, a cross-instance message bus.
- **bcryptjs** — pure JS, no native bindings, standard choice for edge runtimes.
- **@anthropic-ai/sdk** — fetch-based, no Node-specific requirements identified.

## Incompatible Features Found, and What Was Done

### 1. `pdf-parse` — INCOMPATIBLE, replaced

**Finding**: inspecting the installed package's compiled output (both its Node and its own "browser" build) showed `require`/references to `node:worker_threads`, which Cloudflare Workers does not support under any compatibility flag. This was not a guess — grepped directly in `node_modules/pdf-parse/dist/`.

**Fix**: replaced with `unpdf`, which ships a build explicitly documented by its maintainers as "optimized for edge environments" and names Cloudflare Workers by name, with worker-inlining specifically to avoid `worker_threads`. **Verified twice**: (a) grepped the installed `unpdf` bundle for `worker_threads` — zero matches; (b) ran `unpdf`'s `extractText`/`getDocumentProxy` against a real local PDF containing mixed Arabic/English text and confirmed correct extraction output.

### 2. `@opennextjs/cloudflare` requires Next.js ≥15 — Next.js and Prisma upgraded

**Finding**: `@opennextjs/cloudflare@1.20.1`'s peer dependency is `next@">=15.5.18 <16 || >=16.2.6"`. HotelOS was on Next.js 14.2.33, which the current officially-supported adapter simply does not accept.

**Fix**: upgraded to Next.js 15.5.20 (the minimal version satisfying the peer range). This is a real breaking change for the app's own code (Next.js 15's "Async Request APIs": `cookies()` and page/layout `params` became `Promise`-returning). Handled via Next.js's own official codemod (`@next/codemod next-async-request-api`), which mechanically rewrote 30 files; manually verified the `cookies()` rewrite in `src/server/modules/auth/session.ts` was correct. **Verified**: `tsc --noEmit` clean, full `next build` clean, full `opennextjs-cloudflare build` clean.

Prisma was upgraded from 5.22 to 7.8.0 in the same pass (see next item — the two upgrades are entangled, since Prisma 7 is what makes the ORM Workers-compatible at all).

### 3. Prisma's Rust query-engine binary — INCOMPATIBLE, migrated to driver adapters

**Finding**: Cloudflare Workers cannot execute native binaries (no Rust engine process). Prisma's classic client (any version using the default binary query engine) does not run in Workers. Separately, and more surprising: **Prisma 7 removed `datasource.url` from `schema.prisma` entirely** — attempting `prisma generate` with the old schema failed immediately with a clear, documented error pointing at the driver-adapter migration path. This was discovered by literally running the upgraded CLI against the existing schema, not anticipated in advance.

**Fix**: migrated to Prisma's driver-adapter architecture — `@prisma/adapter-pg` + `pg`, no Rust binary at all. Added `prisma.config.ts` for CLI/migration connection config (Prisma 7's replacement for `datasource.url`). Rewrote `src/lib/prisma.ts` as a lazily-constructed, isolate-cached client that resolves its Postgres connection string from a Cloudflare Hyperdrive binding when running in Workers, or `DATABASE_URL` in plain Node.js (local dev, CI, migrations/seed). **Verified**: `tsc` clean; ran a direct Node script confirming the exported `prisma` Proxy correctly forwards to a real `PrismaClient` once a connection string is available, and fails with a clear, actionable error (not a crash) when neither Hyperdrive nor `DATABASE_URL` is present. **Not verified**: an actual query executed against a live Postgres/Hyperdrive — no live database available anywhere in this environment.

### 4. Local filesystem access — INCOMPATIBLE where used at runtime, fixed one real bug

**Finding**: Cloudflare Workers has no writable/readable persistent filesystem at request time. Two usages existed:
- `src/server/modules/storage/local.ts` (`fs.readFile`/`writeFile`) — already architected as a swappable, dev-only adapter behind `StorageAdapter`; never selected when `STORAGE_DRIVER=r2` (the only production-valid option now). No fix needed beyond making sure the R2 path exists (see below).
- `src/app/[locale]/admin/release-notes/page.tsx` (`fs.readFile(path.join(process.cwd(), 'CHANGELOG.md'))`) — this one was a **real, previously-undetected bug**: it compiled and built without any error or warning, but inspecting the actual OpenNext-bundled Worker output confirmed the file reference was present in the code that would execute at request time, with no real `CHANGELOG.md` reachable via a Workers filesystem. **Fixed**: converted to a bundled TypeScript constant (`src/lib/release-notes.ts`), the same pattern already used elsewhere in the codebase for the AI prompt registry. **Verified**: re-built and grepped the bundle — zero `CHANGELOG` references remain in the compiled Worker.

### 5. `initOpenNextCloudflareForDev()` running during production builds — fixed

**Finding**: following the documented setup pattern (call it unconditionally at the top of `next.config.mjs`) caused `opennextjs-cloudflare build` to fail outright: the function eagerly tries to resolve every configured binding's local-dev proxy, including Hyperdrive, which requires a reachable local Postgres connection string that doesn't exist in this environment (or in any environment without one deliberately configured). This is not a Cloudflare-account-dependent problem — it would happen for anyone building without a local Postgres, including in CI.

**Fix**: guarded the call to only run when `process.env.NEXT_PHASE === 'phase-development-server'` (i.e., only during `next dev`, never during `next build`, including the `next build` that `opennextjs-cloudflare build` runs internally). **Verified**: rebuild succeeded end-to-end after the fix.

## Database Compatibility Status

**Prepared, not verified end-to-end.** The driver-adapter + Hyperdrive architecture is the current, officially-documented Cloudflare pattern for Postgres (confirmed against Cloudflare's own Hyperdrive documentation, fetched directly during this work — the `env.HYPERDRIVE.connectionString` + `pg` pattern matches exactly what `src/lib/prisma.ts` implements). What has NOT been exercised: an actual query against a real Supabase database, either directly or through a real Hyperdrive binding. The Proxy-forwarding mechanism itself was verified with a dummy connection string (confirms the code path reaches `PrismaPg`/`PrismaClient` correctly) but the dummy string was never actually connected to.

**Migrations**: `prisma.config.ts` is configured; `prisma generate` and schema validation both work. `prisma migrate dev`/`deploy` were never run against a real database in this environment (none available) — this must happen for the first time against a real Supabase instance, ideally in a disposable/staging database before production. See `docs/SUPABASE_SETUP.md`.

## File Storage Compatibility Status

**Prepared, not verified end-to-end.** `src/server/modules/storage/r2.ts` uses R2's native binding API (`bucket.put/get/delete`), the Cloudflare-recommended approach for code already running inside a Worker (no AWS SDK, no request signing). The lazy-construction pattern mirrors the Prisma client's and was reviewed for the same correctness properties, but has not been exercised against a real R2 bucket — no Cloudflare account available in this environment. MIME type, file size, and hotel-ownership/authorization validation already happen one layer up, in `reports/commands.ts` `uploadReport`, before the storage adapter is ever called — this was true before the Cloudflare work and required no changes.

## Authentication Compatibility Status

**Compatible, verified via build + code inspection.** No changes to the authentication mechanism itself were needed. Session tokens are random bearer tokens (not signed cookies), stored server-side — `SESSION_SECRET` was discovered to be declared-but-unused dead configuration and made optional rather than required, since a required-but-never-read env var would have needlessly blocked Worker cold start on deployments that didn't happen to set it. Secrets (database credentials, `ANTHROPIC_API_KEY`) are read only via `process.env`/Cloudflare bindings, server-side only — confirmed no `NEXT_PUBLIC_*` variable holds anything sensitive (checked `.env.example`/`wrangler.jsonc`).

## What Has Not Been Verified

Stated plainly, once, here, rather than scattered as caveats:

- No live Cloudflare account, Supabase project, or GitHub repository access exists in this environment — nothing was actually deployed, and no deployment URL exists. Per your own instruction: this report does not claim a successful deployment.
- No query has run against a real PostgreSQL database through the driver-adapter/Hyperdrive path.
- No file has been written to or read from a real R2 bucket.
- `wrangler dev`/`opennextjs-cloudflare preview` (an actual local Workers runtime, via Miniflare) has not been run — only `opennextjs-cloudflare build`, which produces the bundle but doesn't execute it. This means: login, `/admin` access, tenant isolation, R2 upload authorization, Arabic RTL, English LTR, and mobile layout have **not** been re-tested in an actual Workers runtime — only in the Next.js dev server (this session) and via static build success (this session).
- `unpdf`'s bundle produced one non-fatal webpack warning ("Critical dependency: Accessing import.meta directly is unsupported") during the Cloudflare build. The build succeeded and produced a working bundle regardless, but this specific code path (likely PDF.js's internal asset-location logic) should be exercised with a real PDF upload in an actual Workers preview before considering PDF extraction production-verified on Workers specifically.
- Windows: OpenNext itself warns it is "not fully compatible with Windows" and recommends WSL or Linux. All verification in this report was performed on Windows and succeeded, but the tool's own warning is reproduced here rather than suppressed — the actual production build/deploy should run on a Linux environment (which is exactly what Cloudflare Workers Builds and GitHub Actions provide — see `docs/CLOUDFLARE_DEPLOYMENT.md`).

## Cloudflare Resources Required

| Resource | Purpose | Free tier sufficient for pilot? |
|---|---|---|
| Cloudflare Workers | Hosts the app | Yes — Workers Free includes 100,000 requests/day |
| Cloudflare Workers Builds (or GitHub Actions) | CI/CD from GitHub, no local install | Yes, included with Workers |
| Cloudflare Hyperdrive | Postgres connection pooling/caching for the Worker | Yes — Hyperdrive itself is free; you pay only for the underlying database |
| Cloudflare R2 | Object storage for PDFs/exports | Yes — R2 free tier: 10GB storage, 1M Class A + 10M Class B ops/month |
| Cloudflare custom domain | Your existing domain, already on Cloudflare | Yes, no extra cost beyond what you already have |
| Supabase (PostgreSQL) | Database | Yes — Supabase Free tier (500MB DB, paused after 1 week inactivity — a real constraint for a pilot, see `docs/SUPABASE_SETUP.md`) |
| Anthropic API key | Executive AI Summary | **Paid** — pay-per-use, not part of Cloudflare/Supabase free tiers; the app runs fully without it (AI summary shows "not configured" rather than failing) |

**Free vs. potentially paid, summarized**: everything Cloudflare-side is coverable by free tiers at pilot scale. Supabase's free tier has a real limitation (auto-pause on inactivity) worth knowing about before committing to it long-term — flagged explicitly in `docs/SUPABASE_SETUP.md`. The only unavoidable paid item, if you want the Executive AI Summary to actually produce output, is Anthropic API usage.

## Estimated Deployment Steps (browser-only, no local install)

1. Create/configure Supabase project, get direct + pooled connection strings (`docs/SUPABASE_SETUP.md`).
2. Create R2 bucket via Cloudflare dashboard (`docs/R2_SETUP.md`).
3. Create Hyperdrive configuration pointing at Supabase, via Cloudflare dashboard.
4. Push this code to a private GitHub repository (`docs/CLOUDFLARE_DEPLOYMENT.md` gives exact browser steps).
5. Connect Cloudflare Workers Builds to that repository; set build command, secrets, and bindings in the dashboard.
6. Run the first migration (`prisma migrate deploy`) — via a one-off GitHub Actions workflow, since this must run from a real Node.js process, not the Worker itself (`docs/CLOUDFLARE_DEPLOYMENT.md`).
7. Trigger the first build/deploy.
8. Seed the production Platform Owner account (random one-time password, forced change) via the same GitHub Actions mechanism.
9. Attach your existing Cloudflare-managed custom domain to the Worker.
10. Verify: login, `/admin`, an actual report upload (exercises R2 + Hyperdrive together), Arabic/English, mobile.

Every step above that involves clicking through the Cloudflare/Supabase/GitHub dashboards must be performed by you — no credentials for any of these three services exist in this environment.
