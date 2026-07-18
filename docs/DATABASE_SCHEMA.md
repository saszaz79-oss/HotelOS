# HotelOS Database Schema (v0.1)

Relational schema for PostgreSQL via Prisma. This document describes entities and relations at a conceptual level; the authoritative `schema.prisma` is generated from this design in Phase 1.

## Conventions

- All primary keys: `id` (cuid/uuid).
- All tables: `createdAt`, `updatedAt` timestamps.
- Every hotel-owned table has `hotelId` (direct FK) or reaches one through exactly one non-nullable parent FK — never optional/nullable tenant linkage.
- Soft-delete (`archivedAt` / `status`) is preferred over hard delete for anything with audit/compliance relevance; hard delete is reserved for genuinely ephemeral data and always audit-logged when user-triggered.

## 1. Identity & Access

**User**
- id, username (unique), passwordHash, displayName, preferredLanguage (`ar`|`en`), status (active/disabled), lastLoginAt
- Not hotel-owned (a user can belong to multiple hotels via membership).

**Hotel**
- id, name, logoUrl, country, city, timezone, currency (default `SAR`), totalRooms, roomTypes (JSON or related `RoomType` table), pmsType, licenseStartDate, licenseExpiryDate, status (active/suspended/archived)
- Root tenant entity — every hotel-owned table ultimately references `Hotel.id`.

**HotelMembership**
- id, userId → User, hotelId → Hotel, role (enum: SUPER_ADMIN\*, HOTEL_ADMIN, GENERAL_MANAGER, FRONT_OFFICE_MANAGER, REVENUE_MANAGER, ANALYST, READ_ONLY), status (active/revoked)
- Unique on (userId, hotelId). \*Super Admin is actually a `User.isSuperAdmin` boolean flag, not a per-hotel membership row — see Architecture §4; a Super Admin need not have membership rows to access hotels, which is precisely why that path is treated as a distinct, audited code path.
- Indexed on (hotelId, userId) and (userId).

**RolePermission** (optional normalization; may start as an in-code enum→permission map in v0.1 and only become a table if custom roles are needed later — see Decisions doc)
- role, permissionKey — defines what each role can do; enforced server-side.

## 2. Reports & Extraction

**ReportUpload**
- id, hotelId → Hotel, uploadedByUserId → User, originalFilename, storageKey, fileSizeBytes, checksumSha256, mimeType, status (uploaded/processing/needs_review/complete/error), createdAt
- Indexed on (hotelId, createdAt).

**ReportDocument**
- id, reportUploadId → ReportUpload, hotelId → Hotel (denormalized for query performance, always equal to parent's hotelId, enforced at write time), reportType (enum: MANAGER_FLASH, RESERVATION_STATISTICS, OPEN_BALANCE, RESERVATION_STATISTICS_1, GENERIC), detectedReportDate, confirmedReportDate, extractionConfidence, rawExtractedText (nullable, for generic fallback / audit)
- One upload can (rarely) contain multiple logical documents if a user batches PDFs into one file in the future — v0.1 assumes 1:1 but the FK shape supports 1:many without migration pain.
- Unique constraint intent on (hotelId, reportType, confirmedReportDate, checksumSha256) to support duplicate detection (exact duplicate blocked; same type+date different checksum flagged for confirmation, not silently unique-constrained away).

**ExtractionJob**
- id, reportDocumentId → ReportDocument, stage (upload/extract/validate/normalize/analyze/complete/error), attempt count, startedAt, completedAt, errorMessage (nullable)
- One-to-many with ReportDocument (retries create new job rows so processing history is preserved, not overwritten).

## 3. Metrics

**MetricDefinition**
- id, key (e.g., `occupancy_pct`, `adr`, `revpar`), label_en, label_ar, unit (percentage/currency/count), isComputed (bool — true for ADR/RevPAR which are derived, not raw-extracted)
- Seed-populated reference table for the Core Metrics list in the PRD; keeps the metric catalog data-driven rather than hardcoded across the codebase.

**HotelMetric**
- id, hotelId → Hotel, metricDate, metricKey → MetricDefinition.key, value (numeric, nullable — null means "unavailable," never coerced to 0), sourceReportDocumentId → ReportDocument (nullable only for manually-entered values, which instead set `enteredByUserId`), isManuallyCorrected (bool), correctedByUserId (nullable)
- Unique on (hotelId, metricDate, metricKey) — one authoritative value per hotel/date/metric; corrections update this row (with the correction itself audit-logged) rather than creating ambiguous duplicates.
- Indexed on (hotelId, metricDate) — the primary access pattern for Mission Control/Comparison Center.

## 4. Insights & Comparisons

**Insight** (health score snapshot + alerts + risks/opportunities)
- id, hotelId → Hotel, insightDate, healthScore (nullable), healthScoreFactors (JSON: array of {factorKey, contribution, status}), generatedAt
- Unique on (hotelId, insightDate); regenerated (versioned via `generatedAt`, latest wins for display, history retained) whenever underlying metrics change for that date.

**Alert**
- id, hotelId → Hotel, insightId → Insight (nullable, some alerts may be metric-triggered without a full insight recompute), severity (critical/warning/info), category, message_en, message_ar, relatedMetricKey (nullable), status (open/acknowledged/resolved)

**Recommendation**
- id, hotelId → Hotel, insightId → Insight, priority, text_en, text_ar, category (risk/opportunity/action), status

Comparisons are **computed on demand** in v0.1 (not persisted) from `HotelMetric` — no dedicated table required; this is a deliberate scale/simplicity tradeoff (see Decisions doc) revisited only if comparison-query load becomes a measured bottleneck.

## 5. AI

**AIConversation**
- id, hotelId → Hotel, userId → User, title (auto-generated from first message), createdAt
- Indexed on (hotelId, userId, createdAt).

**AIMessage**
- id, conversationId → AIConversation, role (user/assistant), content, citedSources (JSON: list of {reportDocumentId or metricKey, date}), messageType breakdown (JSON tagging which parts of an assistant message are fact/calculation/recommendation, used for UI rendering), createdAt

## 6. Exports & Archive

**ExportedReport**
- id, hotelId → Hotel, generatedByUserId → User, language (ar/en), periodStart, periodEnd, storageKey, status (generated/failed), createdAt
- Indexed on (hotelId, createdAt).

The Executive Archive view (PRD §10) is a query surface across `ReportUpload`/`ReportDocument`, `Insight` (as "analyses run"), and `ExportedReport` — not a separate table.

## 7. Audit

**AuditLog**
- id, hotelId (nullable — some actions like Super Admin login are not hotel-scoped), userId → User, action (enum/string, e.g. `hotel.suspend`, `report.delete`, `user.role_change`), metadata (JSON — before/after values where relevant, target entity ids), createdAt, ipAddress (nullable)
- Append-only: no update/delete API exposed for this table outside of a documented, itself-audited data-retention process.
- Indexed on (hotelId, createdAt) and (userId, createdAt).

## 8. Settings & Subscriptions

**HotelSetting**
- id, hotelId → Hotel, key, value (JSON) — flexible per-hotel configuration (e.g., default comparison period, alert thresholds) without schema churn per new setting.

**Subscription** (schema reserved in v0.1, billing logic itself is out of MVP scope per Product Blueprint)
- id, hotelId → Hotel, plan, status, currentPeriodEnd — backed by `Hotel.licenseStartDate/licenseExpiryDate` for access-gating today; a full billing-provider integration is future work.

## 9. Deletion Strategy

- `Hotel`, `User`, `ReportUpload/Document`, `ExportedReport`: soft-delete via `status`/`archivedAt`; hard delete only via an explicit, permissioned, audited admin action, and never cascades to `AuditLog`.
- `HotelMetric` corrections: preserved via `isManuallyCorrected` + audit entry rather than row replacement history table, keeping v0.1 simple; full value-history versioning is a documented future enhancement if correction-auditing needs grow (see Decisions doc).
- `AuditLog`: never deleted by application code; retention/purge (if ever required for compliance) is an infrastructure-level, documented, separately-authorized process.

## 10. Indexing Summary

Every hotel-scoped, date-driven table is indexed on `(hotelId, <date column>)` at minimum: `ReportUpload(hotelId, createdAt)`, `HotelMetric(hotelId, metricDate)`, `Insight(hotelId, insightDate)`, `ExportedReport(hotelId, createdAt)`, `AuditLog(hotelId, createdAt)`. `HotelMembership(userId, hotelId)` is uniquely indexed to make session-time authorized-hotel lookups a single indexed query.

## 11. Metric Normalization Model (summary)

Raw extracted numbers never write directly into a "final" field. They flow: `ReportDocument.rawExtractedText/fields (transient)` → validation → `HotelMetric` (canonical, nullable-safe, source-traceable). This indirection is what lets the product honestly say "we never invent missing values" — the schema itself makes a zero-filled fabrication structurally awkward (you'd have to insert a fake `HotelMetric` row) rather than the path of least resistance.
