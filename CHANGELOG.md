# HotelOS Changelog

Rendered in the Super Admin Console at `/admin/release-notes`. Update this file in the same change as any milestone that ships — see `docs/HOTELOS_CONSTITUTION.md` Definition of Done.

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
