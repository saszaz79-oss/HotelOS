# HotelOS

The Intelligent Operating System for Hotels. See `/docs` for the full product and architecture documentation:

- [`docs/HOTELOS_CONSTITUTION.md`](docs/HOTELOS_CONSTITUTION.md) — non-negotiable rules
- [`docs/PRODUCT_BLUEPRINT.md`](docs/PRODUCT_BLUEPRINT.md) — vision, Agent Architecture, Timeline, Memory
- [`docs/MVP_PRD.md`](docs/MVP_PRD.md) — detailed v0.1 requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, Agent Framework, enterprise scale
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — data model (see `prisma/schema.prisma` for the current authoritative schema, which is ahead of this doc post-pivot — see `docs/DECISIONS.md`)
- [`docs/UX_SYSTEM.md`](docs/UX_SYSTEM.md) — navigation, RTL rules, tokens (visual language refresh pending, see D11)
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — milestone sequencing
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — architectural decision log
- [`docs/PARSER_DOCUMENTATION.md`](docs/PARSER_DOCUMENTATION.md) — every extraction adapter: supported/unsupported layouts, assumptions, failure modes
- [`docs/VALIDATION_REPORT.md`](docs/VALIDATION_REPORT.md) — honest engineering assessment of pipeline reliability (currently: **unmeasured against real data** — read this before trusting any extraction/scoring output)
- [`docs/CLOUDFLARE_COMPATIBILITY_REPORT.md`](docs/CLOUDFLARE_COMPATIBILITY_REPORT.md) — what was and wasn't Workers-compatible, and what was fixed (**start here** for Cloudflare deployment)
- [`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md) — step-by-step browser-only deployment guide
- [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md), [`docs/R2_SETUP.md`](docs/R2_SETUP.md), [`docs/PRODUCTION_ENVIRONMENT.md`](docs/PRODUCTION_ENVIRONMENT.md), [`docs/UPDATE_AND_ROLLBACK.md`](docs/UPDATE_AND_ROLLBACK.md) — the supporting deployment docs

## Cloudflare Workers Deployment

HotelOS is prepared to deploy as a full-stack app on Cloudflare Workers (`@opennextjs/cloudflare`, Postgres via Supabase + Hyperdrive, files via R2) — **not** a static export, **not** Cloudflare Pages Direct Upload. This required real changes, not just configuration: Next.js 14→15, Prisma 5→7 (driver adapters, no Rust engine), and replacing `pdf-parse` (bundles `node:worker_threads`, unsupported on Workers) with `unpdf`. See `docs/CLOUDFLARE_COMPATIBILITY_REPORT.md` for the full, evidence-based account of what was found and fixed.

**Verified in this environment**: `tsc`, `eslint`, `next build`, and `opennextjs-cloudflare build` (the actual Worker bundle) all succeed — including catching and fixing a real bug (a filesystem read that would have failed at Worker request time, found by inspecting the compiled bundle, not by guessing). **Not verified**: an actual deployment. No Cloudflare, Supabase, or GitHub account exists in this environment — nothing has been deployed, and no deployment URL exists. `docs/CLOUDFLARE_DEPLOYMENT.md` is the exact browser-only path to take it from here.

## Platform Administration

HotelOS distinguishes three tiers (`docs/DECISIONS.md` D36): **Platform Owner** (`User.isSuperAdmin`, cross-hotel, not a normal hotel user), **Hotel Admin** (`HOTEL_ADMIN` role, manages one hotel's users/profile), and **Hotel Users** (the other five roles, scoped to their assigned hotel(s)). Platform administration lives at `/admin`, gated to the Platform Owner only and bilingual like the rest of the product (unlike the English-only, engineering-internal `/validation` — see D37 for why they're treated differently).

### 1. Default usernames and passwords (development only)

Seeded by `npm run db:seed` when `NODE_ENV` is not `production` (see `prisma/seed.ts`):

| Role | Username | Password |
|---|---|---|
| Platform Owner (Super Admin) | `superadmin` | `ChangeMe123!` |
| Hotel Admin | `hoteladmin.demo` | `ChangeMe123!` |
| General Manager | `gm.demo` | `ChangeMe123!` |
| Read Only | `readonly.demo` | `ChangeMe123!` |

All four belong to the seeded demo hotel ("HotelOS Demo Hotel (Riyadh)", `pilot` plan). These are shared, documented dev credentials — not temporary passwords in the security sense, so they do **not** force a password change on login (see D9/README note on `mustChangePassword` below for why that's a deliberate distinction, not an oversight). **Never use these in any shared or production deployment.**

### 2. How to create a new hotel

Log in as the Platform Owner → `/admin/hotels` → **Create Hotel**. One form creates the hotel profile (name, logo URL, country, city, currency, timezone, total rooms, PMS type, license start/expiry, subscription plan) **and** its initial Hotel Admin account together — that's a single atomic transaction (`createHotelWithAdmin`), not two separate steps. On success, the page shows the new Hotel Admin's username and a one-time temporary password — copy it immediately, it is never shown again (only re-issuable via a password reset, which invalidates it and generates a new one). Share it with the hotel's admin through a secure channel (not email, since real email delivery isn't wired up yet — see D9).

### 3. How to create users

Two ways:
- **From `/admin/users`** → **Create User**: pick a hotel, a role (Hotel Admin, General Manager, Front Office Manager, Revenue Manager, Analyst, or Read Only), a username and display name. Same one-time-temporary-password pattern as hotel creation.
- **A Hotel Admin creating their own hotel's users** is architecturally planned (PRD §1) but not yet built as a self-service UI in v0.1 — today, all user creation goes through the Platform Owner's `/admin` console regardless of role being assigned.

### 4. How to reset passwords

`/admin/users/[user]` → **Reset Password**. This always issues a brand-new random temporary password (the Platform Owner never chooses or sees a user's actual password — D39) and immediately invalidates that user's existing sessions, so a compromised or unwanted session can't survive a reset. The new temporary password is shown once in the console; the user must set their own password on next login (`mustChangePassword` — see below).

**Forced password change**: any account issued a temporary password (new hotel admin, new user, or a reset) has `mustChangePassword: true`. The very next time they reach any hotel-scoped or admin screen, they're redirected to `/change-password` and cannot proceed until they set a new password (entering their current/temporary one first, so a merely-observed temp password isn't enough on its own).

### 5. How to update HotelOS safely in production

- **Schema changes**: every change goes through `npx prisma migrate dev --name <description>` (generates a committed migration file) — never `prisma db push` against a database holding real data, and production applies pending migrations via `prisma migrate deploy` as a distinct deploy step (`docs/ARCHITECTURE.md` §9 "Migration Discipline"). Migrations are additive-first: a column stops being used before it's ever dropped, in a separate later migration, never in the same change.
- **Data is never wiped by an upgrade** (Constitution §2 rule #9): Hotels, Users, Reports, AI Conversations, and Audit Logs are preserved across every schema change by construction — the discipline above is what guarantees that, not a manual promise.
- **First production bootstrap**: `npm run db:seed` with `NODE_ENV=production` set does **not** create any demo hotel or demo users — it creates exactly one account, username `admin`, with a randomly generated temporary password printed once to the deploy console and never stored anywhere (Constitution §2 rule #10). You must change that password on first login before doing anything else; there is no scenario where a production deployment ends up with a guessable or shared Platform Owner password.
- **Current gap, stated plainly**: no `prisma/migrations/` directory exists yet in this repository — every schema change in this project's history so far was applied via `prisma generate` (client generation only), because no live PostgreSQL database has been available in this development environment. The first time a real database is connected, run `npx prisma migrate dev --name init` once to create the baseline migration; every schema change after that follows the discipline above.

## Current status: Validation Phase (required gate before Roadmap M7+)

**No new business modules, agents, or advanced features are being built right now.** Per explicit Product Owner direction, HotelOS entered a dedicated Validation Phase after the M4–M6 milestones (Mission Control, Decision Engine, Executive AI Summary) shipped — the objective is to prove the extraction/normalization/Health Score/Decision Engine pipeline is trustworthy on **real** Opera data before any further growth. See `docs/VALIDATION_REPORT.md` for the full honest assessment; the short version: **the validation infrastructure is built, but zero real Opera reports have been run through it yet** — accuracy is unmeasured, not "good" or "bad."

What the Validation Phase added:
- **Validation Workspace** at `/validation` (Super Admin only, cross-hotel, English-only internal tool — see `docs/DECISIONS.md` D33): a report list with parsing/validation status, a per-report detail view (per-field Original/Extracted Value, confidence, source page, source snippet, validation status, quality notes, parser warnings, manual corrections, AI Readiness, Decision Engine Readiness), and a Data Quality Dashboard (accuracy, missing/unsupported metrics, confidence/completeness distributions, manual corrections, parser warnings, ground-truth coverage — all computed from real stored data, correctly showing zeros where nothing has been measured yet).
- **Per-field validation status** (`verified` / `needs_review` / `unsupported` / `missing` / `ambiguous`) — nothing is ever `verified` from automatic extraction alone, only after a human confirms it (`docs/DECISIONS.md` D34), plus source-page and source-snippet tracing and genuine ambiguity detection (multiple conflicting label matches).
- **Real Data Mode** infrastructure (`ExtractionGroundTruth` model, `compareExtractionAccuracy`): lets an engineer enter expected values from a real PDF and get a real match/mismatch/false-positive/false-negative accuracy report. Built and verified logically; **not yet exercised against real data** — see `docs/VALIDATION_REPORT.md` §7 for the concrete next step.
- **Timeline traceability fix**: every timeline event now resolves to its actual related entity (the real Recommendation or ReportDocument id), not the parent Insight — the Timeline UI now shows related report/recommendation links and resolves the acting user.
- **Constitution addition**: "Never Hide Uncertainty" — an explicit rule that missing/uncertain data must be shown and explained, never fabricated, extending to engineering documentation itself.

## Milestone history (Phase 1, through M6)

**v0.1 scope note**: this build targets exactly one production-quality workflow — Opera PDF Upload → Validation → Metric Extraction → Normalization → Mission Control → Executive AI Analysis → PDF Export → Archive — plus the platform foundation underneath it. See `docs/ROADMAP.md` and `docs/DECISIONS.md` D22 for why adapter/agent breadth is deliberately deferred.

Implemented and working:
- Next.js App Router project scaffold, TypeScript strict mode, Tailwind.
- Bilingual routing (`/ar`, `/en`) with RTL/LTR `dir` switching and locale-aware layout.
- Prisma schema for the full v0.1 data model, including the Hotel Timeline and Agent-oriented tables added in the OS/Agent pivot.
- Username/password authentication: bcrypt password hashing, database-backed sessions (httpOnly cookies, server-side re-validation on every request — not client-trusted).
- Centralized hotel-scoping (`src/server/modules/hotels/access.ts`) implementing the tenant-isolation rule from Architecture §4.
- Audit log write path.
- Hotel Timeline publish/read functions.
- In-process Domain Event Bus (`src/server/modules/events`, Architecture §17) — real, used internally (e.g. report upload publishes `ReportUploaded`).
- Hotel Genome module scaffolding (`src/server/modules/genome`, Architecture §15) — structured query layer over existing tables (weekday history, prior alert occurrences, recommendation-outcome tracking); no semantic/vector retrieval yet (that's v0.2+).
- Agent Registry (Architecture §13) with the Executive Agent live and Revenue/Front Office Agents registered as visible "coming soon" stubs — the Mission Control shell's navigation is generated from this registry, not hardcoded. No further work proceeds on non-Executive agents until the core workflow is production-quality (D22).
- Feature Flags (`src/server/modules/feature-flags`, Architecture §29) backed by `HotelSetting` — real, wired into report upload and the Agent Runtime as enforcement points.
- CQRS command/query file convention (Architecture §28) — applied starting with the `reports` module (`commands.ts` / `queries.ts`).
- **Report Upload** (Roadmap M2): local-filesystem storage adapter, upload UI/server action, checksum-based exact-duplicate protection, `ReportUpload` record creation, `ReportUploaded` timeline + domain event published on every successful upload.
- **Extraction pipeline** (Roadmap M3): `report-extraction` module subscribes to `ReportUploaded` (a real Event Bus consumer, Architecture §17) and runs report-type detection → the Manager Flash adapter (deterministic label/value regex extraction — see the honesty note in `src/server/modules/report-extraction/adapters/manager-flash.ts`; **accuracy is unvalidated against real Opera exports**, every field carries a confidence score and routes to mandatory manual review) → generic fallback for other report types → **Data Quality Engine scoring** (completeness/confidence/validation status/quality notes, Architecture §33, real as of this milestone) → `ExtractionJob` stage tracking → `ReportUpload.status` moves to `needs_review`.
- **Manual review UI** at `/reports/[reportUploadId]`: shows extracted fields with confidence and Data Quality notes, lets a user correct any value, records corrections as audited actions.
- **Normalization** (Roadmap M4): a "Finalize" action on the review screen requires the user to confirm the report date, then writes reviewed values into canonical `HotelMetric` rows via `src/server/modules/metrics/commands.ts`. ADR/RevPAR are computed server-side from room revenue/rooms sold/rooms available when those components are available, taking precedence over any raw extracted value (Architecture §5). Publishes `MetricsExtracted`.
- **Insights module** (`src/server/modules/insights`, Architecture §31 Decision Engine): subscribes to `MetricsExtracted` and recomputes, per hotel/date: a transparent Health Score (4 weighted, individually-explained factors — occupancy trend, ADR trend, open-balance risk, data completeness; each factor states plainly when there's no prior-date baseline rather than pretending a trend was computed), rule-based Alerts, and rule-based Recommendations (each with rationale, supporting metric values, confidence, priority, and a suggested action — traceable back to the exact `HotelMetric` rows behind it). Recommendations are deterministic/rule-based in v0.1, not AI-generated — kept auditable by construction.
- **AI Orchestration** (`src/server/modules/ai-orchestration`, Architecture §30): a real `AIProvider` abstraction with a working Anthropic implementation, a file-based versioned prompt (Architecture §21) for the Executive Summary, and a `generateExecutiveSummary` pipeline (retrieval → prompt selection → reasoning → validation → citations). Grounded strictly in verified `HotelMetric` values for the latest finalized date; explicitly lists unavailable metrics to the model and instructs it never to state a value for them; a lightweight heuristic check discards (rather than shows) any response that appears to state a number for an unavailable metric. **Requires `ANTHROPIC_API_KEY`** — with no key configured (the default in this environment), it returns a clear "not configured" state rather than fabricating a summary.
- **Mission Control** now renders real data: Health Score with factor breakdown, key metric cards (Occupancy/ADR/RevPAR/Room Revenue/Total Revenue) each showing confidence, completeness, source report filename, and report date per Data Quality Engine requirements, open Alerts, Risks & Opportunities (Recommendations) with the full why/supporting-metrics/confidence/priority/suggested-action structure, and the Executive AI Summary (or its unavailable-state message). Still shows the honest empty state when no metrics have been finalized yet.
- **Mission Timeline UI** at `/timeline`: chronological list of uploads, extraction completion, finalization, alerts, recommendations, and AI summary generation for the hotel.
- **Super Admin Console** at `/admin` (Platform Owner only, bilingual — see "Platform Administration" above for full detail): Hotels Management (create hotel + initial Hotel Admin together, edit profile/license/subscription, activate/suspend/archive), Users Management (create, reset password, activate/disable), Roles & Permissions reference, Feature Flags toggles, Audit Log, System Health, Deployment Version, Release Notes, Support Access (audited read-only hotel view), Platform Settings.
- **Forced password change** for any account issued a temporary password, enforced at the `(app)` and `/admin` layout level.

Explicitly **not yet implemented** (do not assume otherwise):
- Reservation Statistics / Open Balance / Reservation Statistics 1 adapters — these report types currently fall through to the generic fallback (raw text stored, no structured fields) until v0.2 (Roadmap, D22).
- Comparison Center (today-vs-yesterday beyond what feeds the Health Score's own trend factors; no dedicated comparison screen yet) — Roadmap M5-adjacent, not built.
- Revenue Agent, Front Office Agent, Housekeeping Agent, Marketplace UI — explicitly out of scope for this milestone per Product Owner direction; only their registry stubs exist.
- Executive AI Q&A (multi-turn conversation, not just the one-shot summary) — Roadmap M6.
- PDF export, Executive Archive (Roadmap M7–M8).
- S3-compatible storage (only the local-filesystem dev adapter exists — `STORAGE_DRIVER=s3` throws until implemented; never deploy with `STORAGE_DRIVER=local`).
- Plugin SDK runtime, Agent Marketplace UI, Workflow Automation Engine — architecture-only per Product Owner direction, see `docs/ARCHITECTURE.md` §18–§20, §26.
- Self-service "forgot password" flow (email-triggered) — delivery is still mocked/logged (D9); what's built instead is admin-triggered reset via `/admin`, which is a real, complete flow.
- Hotel Admin self-service user creation — all user creation currently goes through the Platform Owner's `/admin` console, even for users being assigned to a Hotel Admin's own hotel (see "Platform Administration" §3 above).
- Hotel logo upload — `/admin` accepts a Logo URL (external link) only; no file upload/storage integration for logos yet.
- Full hotel switcher (v0.1 currently shows a user's first active hotel membership only).
- PWA service worker / offline shell (manifest exists; no service worker yet — do not present the app as installable/offline-capable until this lands).
- Final visual design system (current UI uses placeholder tokens, not the Apple/Linear/Stripe/Tesla-referenced language from `PRODUCT_BLUEPRINT.md`).

## Local development

### Prerequisites
- Node.js 20+
- PostgreSQL 16 (or `docker compose up postgres`)

### Setup

```bash
cp .env.example .env
# edit .env: set SESSION_SECRET to a real random value (see comment in .env.example)

npm install
npm run db:migrate   # creates tables from prisma/schema.prisma
npm run db:seed      # creates demo hotel + demo users (see console output for credentials)
npm run dev
```

App runs at `http://localhost:3000` and redirects to `/ar` (Arabic, RTL) by default.

### Demo credentials (seeded, local development only)

| Username | Password | Role |
|---|---|---|
| `superadmin` | `ChangeMe123!` | Super Admin |
| `gm.demo` | `ChangeMe123!` | General Manager, Demo Hotel |

**These are demo credentials for local development only. Never use them, or ship default credentials, in any shared or production deployment.**

### Quality gates

```bash
npm run lint
npm run typecheck
npm run build
```

Full quality gates (tenant-isolation tests, RTL/LTR verification, role-permission tests, etc. per `docs/HOTELOS_CONSTITUTION.md` §10) will be added as the corresponding features (reports, metrics, AI) are built — there is little to gate yet beyond auth and tenant scoping.

## Deployment

Two supported targets (Architecture §9):
1. **Node hosting via Docker** — `docker compose up` (includes Postgres) or `docker build .` against your own Postgres.
2. **Cloudflare-compatible** — the Next.js app can deploy to Cloudflare where edge-runtime-compatible; stateful work (once report extraction/PDF generation exist) should run on the Node target instead.

A full deployment guide will be written once there is a real deployable feature set beyond authentication (Roadmap M6/M7).
