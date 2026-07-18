# HotelOS v0.1 — MVP Product Requirements Document

## 1. Roles and Permissions

| Role | Scope | Key Permissions |
|---|---|---|
| Super Admin | All hotels | Create/edit/suspend/archive hotels; manage all users; view/compare any hotels; full audit log access; impersonation is NOT permitted (view-as is read-only and logged) |
| Hotel Admin | One or more assigned hotels | Manage users within assigned hotel(s); manage hotel profile; upload/review reports; full Mission Control, Comparison, AI, Export, Archive access within assigned hotel(s) |
| General Manager | Assigned hotel(s) | Full read + AI + export + comparison access; upload reports; cannot manage users |
| Front Office Manager | Assigned hotel(s) | Mission Control, today's operational metrics, upload reports; limited AI scope (operational questions); no export of financial-sensitive reports beyond standard executive PDF |
| Revenue Manager | Assigned hotel(s) | Full metrics, comparisons, AI, export; upload reports; no user management |
| Analyst | Assigned hotel(s) | Read + AI + export; upload reports; no user management, no hotel profile edit |
| Read Only | Assigned hotel(s) | View Mission Control, Comparison Center, Archive; no upload, no AI write actions beyond asking questions (read-level AI use allowed), no export unless explicitly granted |

Permission enforcement: every API route defines the minimum role(s) required; the server derives the caller's role **per hotel** from `HotelMembership` (a user can hold different roles at different hotels). UI navigation hides unavailable actions; the API independently rejects unauthorized calls regardless of UI state.

## 2. Authentication Workflows

### 2.1 Login
- **Given** a user with a valid username/password **when** they submit the login form **then** a server-side session is created and they land on Mission Control for their default hotel.
- **Given** invalid credentials **when** submitted **then** a generic "invalid username or password" error is shown (no distinction between "user not found" and "wrong password") and the attempt is rate-limited.
- **Given** a user with memberships in multiple hotels **when** they log in **then** they see a hotel selector (or their last-used hotel, with a switcher always visible).

### 2.2 Logout
- Logout invalidates the server-side session immediately.

### 2.3 Forgot / Reset Password
- User requests reset via username (or registered email, if present) → system generates a signed, expiring reset token → in v0.1 the delivery channel is mocked (token displayed/logged for internal testing, architecture supports plugging in real email later) → user sets new password via token-validated form → old sessions are invalidated.
- Acceptance: reset tokens expire (e.g., 30 minutes), are single-use, and are never logged in plaintext in any persistent log alongside the user's identity beyond what's needed for the mock-delivery testing flow.

## 3. Multi-Hotel / Tenant Workflows

- Super Admin creates a hotel: name, logo, country, city, timezone, currency, total rooms, room types, PMS type, license start/expiry, status (active/suspended/archived).
- Super Admin or Hotel Admin invites/creates users and assigns hotel membership + role.
- Suspending a hotel blocks all non-Super-Admin access to that hotel's data immediately (existing sessions revalidated on next request).
- Archiving a hotel hides it from normal navigation but retains data for audit/legal purposes; only Super Admin can un-archive.

## 4. Report Processing Workflow

**v0.1 implementation scope note** (see `ROADMAP.md` / `DECISIONS.md` D22): the data model and upload UI recognize all five report categories below, but only the **Manager Flash** adapter is fully implemented and validated for extraction accuracy in v0.1 — Reservation Statistics, Open Balance, and Reservation Statistics 1 route through the generic fallback adapter (raw text stored, manual entry only) until their dedicated adapters ship in v0.2. This is a deliberate narrowing to reach one production-quality workflow before expanding adapter breadth.

**Stages (always visible to the user):** `upload → extract → validate → normalize → analyze → complete` (with an `error`/`needs review` state reachable from any stage).

1. **Upload**: user selects one or more PDFs (Manager Flash, Reservation Statistics, Open Balance, Reservation Statistics 1, or "other/generic"). Files are validated for type/size before accepting. Each file becomes a `ReportUpload` record with original filename, size, checksum, uploader, hotelId, timestamp.
2. **Extract**: system identifies report type (from filename heuristics + in-document markers) and detected report date. If type/date cannot be confidently determined, the user is prompted to confirm/correct both before proceeding.
3. **Validate**: extracted numeric fields are checked for plausibility (e.g., rooms sold ≤ rooms available, percentages within 0–100 unless a documented exception applies). Fields that fail validation or weren't found are flagged, never silently defaulted.
4. **Normalize**: validated values are mapped to the canonical Core Metrics model (§5). Missing metrics remain explicitly null/unavailable — never zero-filled.
5. **Review**: user sees extracted values side-by-side with (where feasible) the source page, confirms or corrects each flagged/uncertain value, then finalizes.
6. **Analyze**: once finalized, the metrics feed comparisons, health score, alerts, and become queryable by the AI assistant.
7. **Complete**: report appears in the Executive Archive with full status history.

**Duplicate protection**: uploads are checked against existing `ReportDocument` records for the same hotel/report-type/report-date/checksum; an exact duplicate is blocked with a clear message; a same-type/same-date-but-different-content upload is flagged for the user to confirm intentional replacement (versioned, not silently overwritten).

**Error recovery**: failed extraction jobs can be retried; persistent failures route the report into a "manual review required" state where a user can still manually enter/correct metrics rather than being blocked entirely.

## 5. Core Metrics Model

Canonical fields (see `DATABASE_SCHEMA.md` for types/constraints): occupancy %, rooms available, rooms sold, rooms occupied, out of order rooms, out of inventory rooms, arrivals, departures, stayovers, cancellations, no-shows, room revenue, total revenue, ADR, RevPAR, open balance, cash, card, city ledger, complimentary rooms, house use rooms, adults, children, total guests.

Rules:
- A given report/date only populates the metrics that report type actually contains; all others remain `unavailable` for that date, not zero.
- ADR/RevPAR are computed server-side when the underlying components (room revenue, rooms sold, rooms available) are present and validated — never trusted as a raw extracted value without cross-check against the components when both are available.
- Every stored metric value references its source `ReportDocument` for traceability.

## 6. Executive Mission Control

**Screen contents**: greeting + selected hotel + selected operational date; Hotel Health Score with contributing factors; occupancy, ADR, RevPAR, room revenue, total revenue; arrivals/departures; open balance; critical alerts; top opportunities; top risks; AI executive summary; today vs. yesterday comparison; recent uploads; quick actions (upload report, ask AI, view archive, export).

**Health Score methodology (transparent, not decorative)**:
- Composed of weighted sub-scores from available metrics only (e.g., occupancy performance vs. hotel's own trailing baseline, ADR trend, open-balance health, data freshness/completeness).
- If a contributing metric is unavailable for the period, its weight is either redistributed among available factors or the factor is shown as "insufficient data" — the score never silently substitutes a guessed value.
- The UI always shows the factor breakdown (e.g., "Occupancy: +8, ADR trend: +5, Open balance risk: −6, Data completeness: 3/6 metrics available") so the number is auditable by the user, not a black box.

**Acceptance**: if a hotel has zero or one report uploaded, Mission Control must still render meaningfully (empty/partial states) rather than error.

## 7. Comparison Center

Supported comparisons: today vs. yesterday; selected date vs. previous day; selected period vs. previous equivalent period; selected hotel vs. another hotel (only for users authorized on both hotels, and only Super Admin / explicitly cross-hotel-authorized roles).

Each comparison row shows: value, absolute change, percentage change (only when mathematically valid — e.g., not computed from a zero or null baseline), interpretation (positive/negative/neutral, using hotel-specific and metric-specific logic, e.g., higher open balance is not automatically "positive"), and a data completeness indicator (e.g., "both periods complete," "baseline period incomplete").

## 8. Executive AI Assistant

Behavior contract (see Constitution §4 for the non-negotiable rules):

- Retrieval is scoped to the requesting user's authorized hotel(s) for the current conversation; no cross-hotel leakage even via indirect phrasing.
- Every answer that references a number cites the source date/report.
- Responses structurally separate facts, calculations, and recommendations.
- If the requested data isn't available, the AI states that explicitly and suggests what upload/action would fill the gap, rather than approximating.
- Conversation history is persisted per hotel + user (`AIConversation`, `AIMessage`), retrievable in the same session and future sessions.
- Bilingual: the AI responds in the language of the question (Arabic or English), and UI copy around it is bilingual.
- Sample supported questions are listed in `PRODUCT_BLUEPRINT.md`/README — the assistant is not a general-purpose chatbot; out-of-scope questions (non-hotel-data topics) are declined with a clear scope statement.

## 9. Reports and Export

- Executive PDF export: hotel name/logo, report date, issued-by user, key metrics, executive summary, comparisons, risks, opportunities, recommended actions, data quality notes — generated server-side, available in Arabic and English.
- Every generated export is saved to the Executive Archive with metadata (who generated it, when, for what date range) and is re-downloadable.

## 10. Executive Archive

- Filterable list (date, report type, status, user, hotel) covering: uploaded reports, analyses run, generated PDF exports.
- Detail view per report shows full processing history (stage timestamps, who reviewed/corrected what).
- Re-run analysis is available for a previously finalized report (re-computes comparisons/health score/alerts from the stored metrics, without re-extracting from the PDF).
- Delete requires elevated permission (Hotel Admin+) and is always audit-logged with the deleted record's key metadata retained in the audit entry itself (so the audit trail survives the deletion).

## 11. Audit and Observability Requirements

- `AuditLog` entries for: login/logout, password reset, user creation/role change, hotel creation/suspension/archive, report upload/delete, export generation, Super Admin cross-hotel access, AI conversation start (metadata only, not full content necessarily, but at minimum which hotel/user/when).
- Application error logs capture enough context (hotelId, userId, route, timestamp, error type) to debug without logging secrets or full PII payloads.
- Report processing logs are queryable per report for support/debugging.
- User-facing error states are always actionable ("retry," "contact support," "correct this field") — never a raw stack trace.

## 12. Error Handling Principles

- Extraction failure ≠ dead end: user can retry or fall back to manual entry.
- Validation failure surfaces the specific field and reason, not a generic "invalid data" message.
- AI failure (provider timeout/error) shows a clear retry option and never silently returns a fabricated answer instead of an error.
- Network/session errors preserve the user's in-progress work where feasible (e.g., in-progress manual review corrections aren't lost on a transient error).
