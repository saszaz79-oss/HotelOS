# HotelOS Changelog

Rendered in the Super Admin Console at `/admin/release-notes` via `src/lib/release-notes.ts` — that file is a TypeScript constant, not a filesystem read of this document, because Cloudflare Workers has no runtime filesystem to read from (confirmed directly during Cloudflare deployment prep: the original filesystem-based implementation compiled without error but would have failed at request time in the deployed Worker). **Update both files together** — this one for GitHub/human readability, `src/lib/release-notes.ts` for the in-app display — see `docs/HOTELOS_CONSTITUTION.md` Definition of Done.

## Unreleased — Forced Password Change Redirect Fix

- Fixed the forced password-change flow crashing for the Platform Owner (Super Admin) after a successful password change: it unconditionally redirected to Mission Control, a hotel-scoped page that assumes a `HotelMembership` the Platform Owner never has by design — now redirects Super Admins to the Super Admin Console (`/admin`) instead, matching how `(app)/layout.tsx` already treats the same case.

## Unreleased — Production Database Setup

- Added `prisma/migrations/` (baseline `init` migration) — generated from and verified against the authoritative `prisma/schema.prisma`, applied cleanly via `prisma migrate deploy` against a fresh database.
- `.github/workflows/migrate.yml` (already present) now reads a single `DATABASE_URL` repository secret, applying pending migrations only when manually triggered from the Actions tab.
- `.github/workflows/seed-production.yml` (already present) now reads the same `DATABASE_URL` secret and seeds a `superadmin` Platform Owner account with a fixed, documented temporary password (`ChangeMe123!`) and forced password change on first login — idempotent, safe to run more than once.
- `prisma/seed.ts`'s production path now creates username `superadmin` (previously `admin` with a random password) for consistency with the development seed's naming.
- Fixed `npm ci` failing during `postinstall` in both workflows: `DATABASE_URL` was only reachable by the later migrate/seed step, not by `npm ci` itself (which runs `prisma generate`, which reads it). Moved to job-level `env`, and added a validation step that fails clearly if required secrets are missing, without ever printing their values.
- Fixed `prisma/seed.ts` (and `src/lib/prisma.ts`'s non-Hyperdrive fallback) failing with `self-signed certificate in certificate chain` against Supabase: added `src/lib/db-ssl.ts`, a shared TLS config that trusts Supabase's actual CA certificate (`DATABASE_CA_CERT`) for real verification — never `rejectUnauthorized: false`, never disabled SSL. `prisma migrate deploy` was unaffected because Prisma's migration engine uses different, looser SSL semantics.
- Fixed the same error recurring even with `DATABASE_CA_CERT` correctly set, whenever `DATABASE_URL` contains an `sslmode=` query parameter: node-postgres merges URL-parsed values over the explicit config, so the URL's `sslmode` silently replaced the CA-bearing `ssl` option. `resolveDatabaseConnection()` now strips ssl-related URL parameters when supplying the explicit (stricter) CA config. Confirmed by A/B test against a real SSL-enabled Postgres: identical config succeeds without `?sslmode=require` and reproduced the exact production failure with it.

## Unreleased — Cloudflare Workers Deployment Preparation

- Migrated to Next.js 15 and Prisma 7 (driver adapters, no Rust query engine) — both required for Cloudflare Workers compatibility.
- Replaced `pdf-parse` with `unpdf` (Cloudflare Workers-documented PDF extraction) — `pdf-parse` bundles `node:worker_threads`, unsupported on Workers.
- Added `src/server/modules/storage/r2.ts` — Cloudflare R2 storage adapter via native binding.
- `src/lib/prisma.ts` rewritten as a lazily-constructed client resolving its connection through a Cloudflare Hyperdrive binding (production) or `DATABASE_URL` (local dev/CI/migrations).
- Added `wrangler.jsonc`, `open-next.config.ts`, `prisma.config.ts` and `cf:build`/`cf:preview`/`cf:deploy` scripts.
- Fixed a filesystem-read bug in the Release Notes page that would have failed silently in production (see note above).

## Unreleased — Platform Ownership & Administration

- Super Admin Console at `/admin`: Hotels Management (create hotel + initial Hotel Admin in one workflow, edit profile/license/subscription, activate/suspend/archive), Users Management (create, reset password, activate/disable), Roles & Permissions reference, Feature Flags toggles, Audit Log viewer, System Health, Deployment Version, Release Notes, Support Access, Platform Settings.
- Forced password change on first login for any account issued a temporary password (new hotel admins, admin-created users, admin-triggered password resets).
- Admin-triggered password reset now invalidates the user's existing sessions.

## v0.1 Validation Phase

- Validation Workspace (`/validation`, Super Admin only): per-report extraction detail, Data Quality Dashboard, Real Data Mode ground-truth/accuracy comparison.
- Per-field validation status (verified/needs_review/unsupported/missing/ambiguous) with source page and snippet tracing.
- Parser Documentation and an honest Validation Report (accuracy currently unmeasured against real data).
- Constitution addition: "Never Hide Uncertainty."
- Timeline traceability fix: events now resolve to their real related entity.

## v0.1 M4–M6 — Executive Mission Control

- Normalization: reviewed report values write to canonical `HotelMetric` rows; ADR/RevPAR computed server-side from components when available.
- Insights module: transparent, factor-explained Health Score; rule-based Alerts and Recommendations (Decision Engine — why, supporting metrics, confidence, priority, suggested action).
- AI Orchestration: real `AIProvider` abstraction (Anthropic), file-based versioned prompt, grounded Executive AI Summary — fails closed (states "not configured") rather than fabricating output.
- Mission Control renders real data with Data Quality (confidence/completeness/source/date) on every metric.
- Mission Timeline UI.

## v0.1 M2–M3 — Report Upload & Extraction

- Report upload with checksum-based duplicate protection.
- Manager Flash extraction adapter (accuracy unvalidated against real Opera exports — see Validation Report), generic fallback for other report types.
- Data Quality Engine scoring (completeness, confidence, validation status, quality notes).
- Manual review UI with per-field correction.

## v0.1 M1 — Platform Foundation

- Bilingual (Arabic/English) Next.js application shell with RTL/LTR support.
- Username/password authentication with bcrypt hashing and database-backed sessions.
- Multi-tenant hotel/user model with centralized hotel-scoping enforcement.
- Agent Runtime, Hotel Timeline, Domain Event Bus, Hotel Genome scaffolding, Feature Flags.
