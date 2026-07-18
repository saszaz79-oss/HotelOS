# HotelOS Constitution

This document is the highest-authority reference for HotelOS. Every architectural decision, feature, and line of code must be consistent with it. When in doubt, this document wins.

## 1. Product Philosophy

HotelOS is an **intelligence and decision-support layer**, not a PMS replacement, not a generic BI dashboard, and not a PDF-to-chart converter. It is, structurally, a **Decision Engine**: Data → Metrics → Insights → Recommendations → Priorities → Decisions → Actions (`ARCHITECTURE.md` §31) — not only an AI assistant bolted onto reports. Its job is to turn fragmented hotel data (Opera Cloud reports, spreadsheets, OTA data, emails) into decisions a hotel executive can act on today.

### The Product Principle

Every future feature, module, agent, or plugin must answer one question before it becomes part of HotelOS:

> **Does this help hotel management make better decisions?**

If the honest answer is no, it does not belong in HotelOS — regardless of how technically impressive, how requested by one loud customer, or how easy it would be to build. This is the single highest-authority product gate; the three tests below are how it is applied in practice at the feature level.

Three tests every feature must pass:

1. **Decision test** — does this help someone decide or act faster/better? A chart that is merely "interesting" fails this test. (This is the Product Principle above, applied concretely.)
2. **Truth test** — is every number traceable to a source document and a timestamp? If we can't show our work, we don't show the number.
3. **Restraint test** — does this belong in the MVP, or is it future-module scope creep? See `ROADMAP.md`.

### Never Hide Uncertainty

A sharpened restatement of the Truth Test, made an explicit named rule because it governs the entire Validation Phase (`ROADMAP.md`) and every extraction/scoring/recommendation surface in the product:

> If something cannot be extracted, computed, or predicted with confidence, HotelOS must **show it, explain it, and allow manual correction — never fabricate a value to fill the gap.**

Concretely: a missing field is displayed as missing, not zero. A low-confidence extraction is labeled `needs_review`, not silently presented as fact. A recommendation states the metrics and confidence behind it, never appears as unexplained "AI magic." An unmeasured accuracy claim is stated as unmeasured (see `VALIDATION_REPORT.md`), never rounded up to sound more finished than it is. This rule applies to engineering documentation and status reporting exactly as much as it applies to product UI — a validation report that overstates readiness violates this rule as much as a UI that fabricates a metric.

## 2. Non-Negotiable Rules

1. No feature ships claiming to work ("AI-powered," "automated," "secure") unless it is genuinely implemented end-to-end. Placeholder/mock functionality must be visibly labeled as demo/mock in the UI — never disguised as live.
2. No hotel's data is ever visible, queryable, or inferable by another hotel's users. This is enforced at the query layer, not just the UI layer.
3. Every database write and read that touches hotel-owned data must be scoped by `hotelId`, enforced in a shared data-access layer — never left to individual route handlers to remember.
4. The Super Admin role is the only role that can cross hotel boundaries, and every cross-hotel access it performs is audit-logged.
5. AI features never fabricate operational facts. If data is missing, the AI says so explicitly rather than estimating silently.
6. Passwords are never stored in plaintext or reversible form. Secrets never reach client-side code or logs.
7. Every sensitive action (login, password reset, user role change, hotel creation/suspension, report deletion, data export, cross-hotel access by Super Admin) is written to the Audit Log with `hotelId`, `userId`, `action`, `timestamp`, and metadata.
8. Demo/seed data is clearly labeled as such in the UI (e.g., a "Demo Data" badge) and never mixed silently with real uploaded data.
9. Schema changes ship as additive Prisma migrations, never as a database wipe/reset. Hotels, Users, Reports, AI Conversations, and Audit Logs are never deleted by a schema upgrade — see `ARCHITECTURE.md` §9 "Migration Discipline."
10. Production deployments never run with a known or default Platform Owner password — the seed process must generate a random, single-use temporary password on first production bootstrap and force a change before any other action is possible.

## 3. UX Principles

- **Executive-first**: the primary user is a General Manager or Revenue Manager glancing at a phone between meetings, not an analyst living in the tool all day. Default views must answer "how are we doing and what do I need to do" in under 10 seconds.
- **Show your work**: every metric, score, and AI statement links back to its source (report name, date, page/section if applicable).
- **No dead ends**: every empty state, error state, and loading state must tell the user what is happening and what to do next.
- **Arabic-first, not Arabic-added**: RTL is a first-class layout mode designed from the token/layout level up, not a mirrored afterthought.
- **Calm, not busy**: information density is earned by user need (executive summary is sparse; archive/detail tables are dense), not by decoration.

## 4. AI Truthfulness Rules

1. The AI assistant only answers from data belonging to the authorized hotel(s) of the requesting user.
2. The AI must cite which dates, reports, and metrics it used to construct an answer.
3. The AI must distinguish three categories of statement: **facts** (directly extracted/stored values), **calculations** (derived from facts, e.g. variance %), and **recommendations** (judgment calls). These must be visually or textually distinguishable in the response.
4. If the AI cannot answer because data is missing or unverified, it must say so plainly rather than approximating or inventing a plausible-sounding number.
5. AI provider details (which model, prompt structure) are an implementation detail hidden behind an internal abstraction — the product must not become locked to one vendor.

## 5. Security Principles

- Authentication: username + password, hashed with a modern adaptive algorithm (bcrypt/argon2), server-side session management (not client-trusted JWT-only for authorization decisions without server validation).
- Authorization: enforced server-side on every route/query, in addition to any UI-level hiding of controls. UI hiding is a UX convenience, never a security boundary.
- File uploads are validated (type, size, content sniffing) before processing; never executed; stored in isolated per-hotel storage paths.
- All hotel-scoped queries pass through a single data-access layer that injects/validates `hotelId` — no ad-hoc raw queries against hotel-owned tables.
- Secrets (DB credentials, AI provider API keys, storage credentials) live only in server-side environment variables, never in client bundles, never committed to git.
- Rate limiting and input validation (Zod) apply at every API boundary.

## 6. Multi-Tenant Rules

- `hotelId` is a required column (or enforced-parent relationship) on every hotel-owned table.
- A user's accessible hotel set is defined by `HotelMembership` rows; the server derives the accessible-hotel list from the session on every request — it is never trusted from client input.
- Super Admin bypasses hotel scoping explicitly and intentionally via a distinct code path (not by having membership rows for every hotel), and that path is audit-logged.
- Comparing hotel A to hotel B is only permitted for users explicitly authorized for both, and is itself an audited action.

## 7. Coding Standards

- TypeScript strict mode everywhere. No `any` without justification comment.
- Domain-modular monolith: each domain module (auth, hotels, reports, metrics, ai, etc.) owns its own data-access functions; cross-module access goes through exported module interfaces, not direct table reads from another module's tables.
- Zod schemas validate all external input (API request bodies, file metadata, environment variables) at the boundary.
- No silent catch blocks. Errors are logged with enough context to debug (hotelId, userId, action) and surfaced to the user as a clear, non-technical message.
- Prefer explicit code over clever abstractions. Three similar call sites are fine; a generic framework for two use cases is not.

## 8. Performance Standards

- Mission Control (executive home) must be interactive within 2 seconds on a mid-tier mobile connection for cached/typical data volumes.
- Report processing runs asynchronously with visible stage progress; the UI is never blocked waiting on extraction/AI calls.
- Database queries on hotel-scoped tables are indexed on `(hotelId, date)` or equivalent access patterns from day one.

## 9. Mobile / PWA Standards

- Mobile-first responsive layout; every screen must be fully usable at 360px width.
- Installable as a PWA (manifest, service worker, offline app-shell) from v0.1.
- Touch targets ≥ 44px; bottom navigation on mobile, sidebar/command nav on desktop.
- Architecture must not preclude later native app-store packaging (e.g., via Capacitor) — no assumptions that break in a WebView.

## 10. Definition of Done

A feature is "done" only when:

1. It works against real data flow end-to-end (not a mocked happy path), or is explicitly labeled as a stub with a tracked follow-up.
2. It is scoped correctly for multi-tenancy and covered by at least one tenant-isolation test.
3. It has Arabic RTL and English LTR verified.
4. It has mobile and desktop layouts verified.
5. It handles its own error/empty/loading states.
6. Sensitive actions are audit-logged.
7. Lint, type-check, and relevant tests pass.
8. No secret, credential, or internal-only detail is exposed to the client.
