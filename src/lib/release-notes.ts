/**
 * Release notes, duplicated from CHANGELOG.md as a bundled TS constant —
 * NOT read from the filesystem at request time. Cloudflare Workers has no
 * runtime filesystem; `fs.readFile(path.join(process.cwd(), 'CHANGELOG.md'))`
 * compiled without error but would have failed (or silently returned
 * nothing useful) the moment the deployed Worker actually served a request
 * — caught during Cloudflare deployment prep by inspecting the OpenNext
 * bundle output, not by a runtime crash in this environment (no live
 * Workers deployment available to trigger it directly).
 *
 * Keep in sync with CHANGELOG.md at the repo root — that file remains the
 * canonical, GitHub-readable version; this one is what /admin/release-notes
 * actually renders.
 */
export interface ReleaseNoteSection {
  title: string;
  items: string[];
}

export const RELEASE_NOTES: ReleaseNoteSection[] = [
  {
    title: 'Unreleased — Production Database Setup',
    items: [
      'Added prisma/migrations/ (baseline init migration) — generated from and verified against the authoritative prisma/schema.prisma.',
      'GitHub Actions workflows for prisma migrate deploy and production seeding now read a single DATABASE_URL repository secret.',
      'Production seed creates a superadmin Platform Owner with a fixed, documented temporary password and forced password change on first login — idempotent, safe to run more than once.',
      'Fixed npm ci failing during postinstall in both workflows by moving DATABASE_URL to job-level scope, with a validation step that fails clearly (never printing the value) if secrets are missing.',
      "Fixed the production seed failing with a certificate verification error against Supabase by trusting Supabase's actual CA certificate (DATABASE_CA_CERT) for real TLS verification, shared between the seed script and the app's own runtime client.",
    ],
  },
  {
    title: 'Unreleased — Cloudflare Workers Deployment Preparation',
    items: [
      'Migrated to Next.js 15 and Prisma 7 (driver adapters, no Rust query engine) — both required for Cloudflare Workers compatibility.',
      "Replaced pdf-parse with unpdf (Cloudflare Workers-documented PDF extraction) — pdf-parse bundles node:worker_threads, unsupported on Workers.",
      'Added src/server/modules/storage/r2.ts — Cloudflare R2 storage adapter via native binding.',
      'src/lib/prisma.ts rewritten as a lazily-constructed client resolving its connection through a Cloudflare Hyperdrive binding (production) or DATABASE_URL (local dev/CI/migrations).',
      'Added wrangler.jsonc, open-next.config.ts, prisma.config.ts and cf:build/cf:preview/cf:deploy scripts.',
      'Fixed a filesystem-read bug in this very Release Notes page that would have failed in production.',
    ],
  },
  {
    title: 'Unreleased — Platform Ownership & Administration',
    items: [
      'Super Admin Console at /admin: Hotels Management (create hotel + initial Hotel Admin in one workflow, edit profile/license/subscription, activate/suspend/archive), Users Management (create, reset password, activate/disable), Roles & Permissions reference, Feature Flags toggles, Audit Log viewer, System Health, Deployment Version, Release Notes, Support Access, Platform Settings.',
      'Forced password change on first login for any account issued a temporary password (new hotel admins, admin-created users, admin-triggered password resets).',
      "Admin-triggered password reset now invalidates the user's existing sessions.",
    ],
  },
  {
    title: 'v0.1 Validation Phase',
    items: [
      'Validation Workspace (/validation, Super Admin only): per-report extraction detail, Data Quality Dashboard, Real Data Mode ground-truth/accuracy comparison.',
      'Per-field validation status (verified/needs_review/unsupported/missing/ambiguous) with source page and snippet tracing.',
      'Parser Documentation and an honest Validation Report (accuracy currently unmeasured against real data).',
      'Constitution addition: "Never Hide Uncertainty."',
      'Timeline traceability fix: events now resolve to their real related entity.',
    ],
  },
  {
    title: 'v0.1 M4–M6 — Executive Mission Control',
    items: [
      'Normalization: reviewed report values write to canonical HotelMetric rows; ADR/RevPAR computed server-side from components when available.',
      'Insights module: transparent, factor-explained Health Score; rule-based Alerts and Recommendations (Decision Engine — why, supporting metrics, confidence, priority, suggested action).',
      'AI Orchestration: real AIProvider abstraction (Anthropic), file-based versioned prompt, grounded Executive AI Summary — fails closed (states "not configured") rather than fabricating output.',
      'Mission Control renders real data with Data Quality (confidence/completeness/source/date) on every metric.',
      'Mission Timeline UI.',
    ],
  },
  {
    title: 'v0.1 M2–M3 — Report Upload & Extraction',
    items: [
      'Report upload with checksum-based duplicate protection.',
      'Manager Flash extraction adapter (accuracy unvalidated against real Opera exports — see Validation Report), generic fallback for other report types.',
      'Data Quality Engine scoring (completeness, confidence, validation status, quality notes).',
      'Manual review UI with per-field correction.',
    ],
  },
  {
    title: 'v0.1 M1 — Platform Foundation',
    items: [
      'Bilingual (Arabic/English) Next.js application shell with RTL/LTR support.',
      'Username/password authentication with bcrypt hashing and database-backed sessions.',
      'Multi-tenant hotel/user model with centralized hotel-scoping enforcement.',
      'Agent Runtime, Hotel Timeline, Domain Event Bus, Hotel Genome scaffolding, Feature Flags.',
    ],
  },
];
