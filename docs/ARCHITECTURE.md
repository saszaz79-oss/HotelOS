# HotelOS Architecture

## 0. Platform, Not Application

HotelOS is architected to be extensible for a ten-year horizon, not just shippable for v0.1. Concretely: the core (auth, tenancy, metrics, timeline, genome, audit) must never need to change shape to accommodate a new capability — new capability arrives as a **plugin**, an **agent**, or a **workflow**, registered against stable extension points (§17–§25), the same discipline already established for agents in §13. This section is the platform-level frame those sections implement; **§26 states explicitly which parts of this are real code in v0.1 and which are documented interfaces with no UI yet** — read that section before assuming any given capability is usable today.

## 1. System Architecture Overview

HotelOS v0.1 is a **modular monolith**, not microservices — the domain boundaries below are enforced in code (module interfaces), not by network calls, to keep the MVP simple to build, deploy, and reason about while preserving a clean extraction path later if scale demands it. On top of the domain modules sits an **Agent Runtime**: the technical implementation of the product's Agent Architecture (see `PRODUCT_BLUEPRINT.md`), through which all AI-facing, operationally-scoped capability is delivered.

```
┌───────────────────────────────────────────────────────────────────┐
│                    Next.js Application (Mission Control Shell)      │
│  ┌───────────────┐   ┌────────────────────────────────┐            │
│  │  App Shell /   │   │  Server Routes / Route Handlers │            │
│  │  App Router    │   │  (API layer)                    │            │
│  │  (RSC + PWA)   │   │                                  │            │
│  └───────┬───────┘   └────────────────┬─────────────────┘            │
│          │                             │                              │
│  ┌───────▼─────────────────────────────▼─────────────────────────┐   │
│  │                        Agent Runtime                            │   │
│  │  Agent Registry · Permission Scoping · AI Orchestration Bridge  │   │
│  │  ┌───────────────┐ ┌──────────────┐ ┌─────────────────────┐    │   │
│  │  │ Executive      │ │ Revenue       │ │ Front Office ...     │    │   │
│  │  │ Agent (v0.1)   │ │ Agent (stub)  │ │ Agent (stub)         │    │   │
│  │  └───────┬────────┘ └──────┬───────┘ └──────────┬────────────┘    │   │
│  └──────────┼─────────────────┼────────────────────┼─────────────┘   │
│             │                 │                     │                 │
│  ┌──────────▼─────────────────▼─────────────────────▼─────────────┐   │
│  │              Domain Modules (server-only, agent-agnostic)        │   │
│  │  auth · users · hotels · memberships · roles-permissions         │   │
│  │  reports · report-extraction · metrics · comparisons · insights  │   │
│  │  timeline · genome · exports · audit · subscriptions · settings  │   │
│  └───────┬──────────────────────────┬──────────────────────────────┘   │
│          │                          │                                   │
│  ┌───────▼────────┐        ┌────────▼─────────┐                         │
│  │  Prisma / ORM   │        │  Storage Adapter  │                         │
│  │  (PostgreSQL)   │        │  (S3-compatible)  │                         │
│  └────────────────┘        └───────────────────┘                         │
└───────────────────────────────────────────────────────────────────────┘
                │
      ┌─────────▼──────────┐
      │  AI Provider        │
      │  Abstraction Layer   │──▶ Anthropic / OpenAI / other
      └──────────────────────┘
```

Key structural point: **agents do not own data** — `metrics`, `timeline`, `genome`, `reports`, and `insights` remain shared, agent-agnostic domain modules. An agent is a *consumer and orchestrator* (its own frontend surface + a scoped view over shared modules + its own AI system prompt/tool set + its own permission gate), never a second copy of the data layer. This is what keeps adding a new agent a bounded, additive change rather than a fork.

## 2. Domain Boundaries

Each module in `src/server/modules/<domain>` exposes a typed interface (functions, not raw Prisma access) that other modules must go through. A module owns its own Prisma models conceptually; cross-module joins happen through explicit exported query functions, not by another module importing another module's Prisma delegate directly. This keeps the "modular" part real even inside one deployable app, and makes a future service split mechanical rather than a rewrite.

- `auth` — session/credential management, password hashing/reset.
- `users` / `memberships` / `roles-permissions` — identity and per-hotel authorization.
- `hotels` — hotel profile CRUD, lifecycle (active/suspended/archived).
- `reports` / `report-extraction` — upload handling, adapter-based extraction pipeline, review workflow.
- `metrics` — canonical metric storage and retrieval, ADR/RevPAR computation rules.
- `comparisons` — period/hotel comparison logic.
- `insights` — health score, alerts, risks/opportunities generation.
- `timeline` — append-only chronological event log per hotel; every other module publishes events into it (see §13).
- `genome` — the Hotel Genome: long-term operational identity built from timeline + metrics + conversations + recommendation outcomes; read surface for agents (see §15).
- `ai-orchestration` — provider-agnostic completion layer, grounded retrieval primitives, conversation persistence. Not itself user-facing — consumed by the Agent Runtime (see §13), never called directly by a route handler the way v0.1's original single "ai" module was.
- `exports` — PDF generation, archive linkage.
- `audit` — write-only audit log service used by every other module.
- `subscriptions` / `settings` — license/plan metadata, hotel-level settings.

## 3. Data Flow: Report Upload → Mission Control

1. Client uploads PDF(s) → route handler validates file (type/size/hash) → `reports` module creates `ReportUpload` + stores file via storage adapter → a `timeline` event (`report.uploaded`) is published.
2. `report-extraction` module runs an adapter pipeline (per detected report type) → produces raw extracted fields + confidence flags → status moves through `extract → validate`.
3. Extraction results surface in the Review UI; user confirms/corrects → `metrics` module normalizes into canonical `HotelMetric` rows tied to `hotelId` + date + source `ReportDocument` → a `timeline` event (`report.finalized`) is published (also emitted on the Event Bus, §17, as `MetricsExtracted`), and the `genome` module indexes the finalized report into the Hotel Genome.
4. `insights` module recomputes health score/alerts for the affected date(s) when metrics change → alerts/recommendations are published as `timeline` events (`alert.raised`, `recommendation.issued`).
5. `comparisons` module computes on-demand (not pre-materialized in v0.1, given MVP data volume) when Mission Control or Comparison Center is requested.
6. The **Executive Agent**, when queried, retrieves scoped `HotelMetric` + `ReportDocument` + `Insight` + `TimelineEvent` + Hotel Genome records for the authorized hotel(s) via the Agent Runtime, using a versioned, registered prompt (§21) rather than an inline string, and constructs a grounded prompt through `ai-orchestration`'s provider abstraction. The resulting conversation is itself persisted and published as a `timeline` event (`ai.conversation`) and folded into the genome.
7. Every state-changing step in this flow writes to `audit` where it qualifies as a sensitive action (see PRD §11); timeline events and audit log entries are deliberately distinct (timeline is product-facing operational history, audit is compliance/security-facing) even though some actions produce both.

## 4. Multi-Tenancy Approach

- **Row-level scoping**: every hotel-owned table has a `hotelId` column (or reaches one through a single non-nullable parent FK, e.g. `ReportMetric.reportDocumentId → ReportDocument.hotelId`).
- **Enforced access layer**: all module query functions that touch hotel-owned tables require an explicit `authorizedHotelIds: string[]` (or `role: 'SUPER_ADMIN'`) parameter derived server-side from the session — never from client-supplied input — and apply it as a `WHERE hotelId IN (...)` (or via the parent join) at the query-builder level. This is implemented once, centrally, and reused, so no individual route can "forget" the filter.
- **Super Admin path**: a distinct, explicitly-named function path (e.g. `withSuperAdminScope`) is required to bypass hotel filtering; calling it triggers an audit log entry automatically, not as an opt-in the developer might skip.
- **Testing**: tenant-isolation is covered by automated tests that attempt cross-hotel access with a non-Super-Admin session and assert rejection (see Quality Gates).

## 5. Authentication

- Username + password login; passwords hashed with bcrypt (or argon2id) with per-password salt, adaptive cost factor.
- Sessions: server-side session store (database-backed session table or equivalent), httpOnly + secure + sameSite cookies. Session token itself is opaque; authorization is always re-derived server-side from the session record, not decoded from a client-trusted JWT payload.
- Password reset: signed, expiring, single-use token; delivery abstracted behind a `NotificationProvider` interface, mocked (logged) in v0.1, swappable for real email later without touching business logic.
- Route protection: Next.js middleware checks session presence for all non-public routes; each server route additionally re-checks role/hotel authorization at the data-access layer (defense in depth — middleware alone is not the security boundary).

## 6. Storage

- `StorageAdapter` interface (`put`, `get`, `getSignedUrl`, `delete`) with an S3-compatible implementation (works with AWS S3, Cloudflare R2, or any S3-compatible provider) as the default; a local-filesystem implementation is acceptable for local dev only, selected via environment config, never in production.
- Uploaded files are stored under a per-hotel-prefixed key (e.g., `hotels/{hotelId}/reports/{reportUploadId}/{filename}`) so storage-level access patterns mirror tenant boundaries even before hitting application logic.
- Generated PDF exports are stored the same way, under `hotels/{hotelId}/exports/...`.

## 7. Report Processing (Extraction Adapters)

- `ReportExtractionAdapter` interface: `detect(file) → confidence/type`, `extract(file) → RawExtractionResult`.
- One adapter implementation per supported report type (Manager Flash, Reservation Statistics, Open Balance, Reservation Statistics 1) using deterministic text/layout parsing (PDF text extraction + pattern matching against known label/value positions for the sample formats HotelOS is built against).
- A `GenericFallbackAdapter` handles unrecognized PDFs: extracts raw text for storage/search but does not attempt structured field mapping, and clearly marks the report as "unstructured — manual entry only" in the UI.
- Adapter architecture is designed so a new report type is added by implementing the interface, not by modifying pipeline/orchestration code (open/closed).
- Supported layouts are explicitly documented (see README) — the product does not claim universal Opera PDF support.

## 8. AI Provider Abstraction

- `AIProvider` interface: a single method surface (e.g., `complete(messages, context) → response`) implemented per vendor (Anthropic, OpenAI, etc.), selected via environment configuration.
- The `ai-orchestration` domain module builds the grounded context (retrieved metrics/reports/insights/timeline/genome, conversation history, system rules) independent of which provider is configured — business logic (truthfulness rules, citation requirements, scoping) lives in the module, not in a provider-specific prompt hardcoded elsewhere. The prompts themselves are sourced from the Prompt Registry (§21), never inlined.
- This module is a shared primitive consumed by every agent through the Agent Runtime (§13) — an agent supplies its own system prompt, tool/data scope, and permission gate; it does not reimplement provider calls, truthfulness enforcement, or citation formatting.
- API keys are read from server-side environment variables only; the provider client is never instantiated or called from client code.

## 9. Deployment Strategy

- Primary target: Node hosting (containerized via Docker) for full control over the Postgres connection, background job processing (report extraction, PDF generation), and file storage integration.
- Cloudflare-compatible path: the Next.js frontend/edge-renderable routes can deploy to Cloudflare Pages/Workers where compatible; stateful/long-running work (extraction pipeline, PDF generation) runs on the Node service rather than being forced into edge runtime constraints. This is documented as two deployment targets, not a forced single-runtime constraint that would compromise the extraction pipeline.
- Environment-based configuration (`.env`) for DB connection, storage credentials, AI provider keys, session secret — see `.env.example`.

### Migration Discipline

Per Constitution §2 rule #9 — schema changes must never require wiping the database or losing Hotels, Users, Reports, AI Conversations, or Audit Logs:

- **All schema changes ship as `prisma migrate dev --name <description>`-generated migrations**, committed to `prisma/migrations/`, never as a manually-edited SQL file and never via `prisma db push` against any environment holding real data (`db push` has its place only for local, disposable dev databases with nothing worth keeping).
- **Production migrations run via `prisma migrate deploy`** (applies pending migrations without prompting or diffing), as a distinct deploy-pipeline step — never `migrate dev` in production, since that command can prompt for destructive-change confirmation interactively, which has no safe meaning in an automated deploy.
- **Additive-first schema design**: prefer new nullable columns, new tables, and new enum values over renaming or removing existing ones. A column that's no longer used is deprecated (stops being written/read by application code) before it is ever dropped in a later, separate migration — never combined into one change that both stops using and removes a column, so a rollback of the application code doesn't leave the schema in a broken state.
- **Current status of this repository**: no `prisma/migrations/` directory exists yet — every schema change so far in this project's history was applied via `prisma generate` (client generation only) against no live database, since this development environment has no Postgres instance available. **The first time a real PostgreSQL database is connected, run `npx prisma migrate dev --name init` once to create the baseline migration from the current `schema.prisma`.** From that point forward, every subsequent schema change must go through `prisma migrate dev` to generate its own incremental migration — this baseline step is a one-time bootstrap, not a pattern to repeat.

## 10. Scaling Strategy

Superseded in detail by §16 (Enterprise Scale) — this section is retained as the short version. Modular monolith boundaries are the seams for future service extraction (e.g., report-extraction or the Agent Runtime itself as independent worker services) if/when volume demands it. Report processing and agent AI calls are async jobs from day one so moving to a real job queue/worker pool later doesn't change module external interfaces. Read-heavy Mission Control/Comparison queries are indexed for the `(hotelId, date)` access pattern from v0.1, because retrofitting indexing strategy at 1000-hotel volume is materially harder than designing for it now (see §16).

## 11. Backup and Recovery

- PostgreSQL: automated daily backups with point-in-time recovery where the hosting provider supports it; documented in the deployment guide.
- Uploaded source PDFs and generated exports in object storage are the durable source of truth for re-extraction if metric data ever needs to be rebuilt — extraction is designed to be re-runnable from the stored original file.
- Audit logs are append-only and excluded from any bulk-delete tooling.

## 12. Security Threat Considerations

- **Cross-tenant data leakage** — mitigated by the centralized hotel-scoping data-access layer (§4) and automated isolation tests.
- **File-upload attacks** (malicious PDF, oversized file, disguised file type) — mitigated by type/size validation and content sniffing before processing; files are never executed, only parsed as text/PDF structure.
- **Credential stuffing / brute force** — mitigated by rate limiting on login/reset endpoints and generic error messaging.
- **Session hijacking** — mitigated by httpOnly/secure/sameSite cookies and server-side session invalidation on logout/password change.
- **AI prompt injection via uploaded report content** — the `ai-orchestration` module treats retrieved report text as data, not instructions; system-level grounding rules are not overridable by content found in a report or user message, and this rule applies identically inside every agent since none of them bypass `ai-orchestration`.
- **Secret exposure** — mitigated by strict environment-variable-only secret handling and a build-time check that no `NEXT_PUBLIC_*` variable ever holds a credential.
- **Cross-agent privilege leakage** — an agent scoped to Front Office data must not be able to retrieve Finance-only data through a shared retrieval helper; mitigated by each agent declaring an explicit data-scope manifest (§13) that the Agent Runtime enforces centrally, the same way hotel-scoping is centrally enforced (§4) rather than left to each agent's discretion.
- **Genome poisoning** — a manually-corrected-to-be-wrong metric or an adversarial report shouldn't quietly become part of a hotel's "learned identity" treated as ground truth; mitigated by the genome indexing only finalized (reviewed) data and retaining full provenance back to source documents (§15), so a bad genome entry is traceable and correctable, not silently authoritative forever.
- **Plugin/third-party trust boundary** — a future installed plugin or agent runs with the permissions explicitly granted in its manifest (§18) and nothing else; mitigated by the same centralized enforcement pattern as hotel-scoping and agent data-scope (§4, §13) rather than trusting a plugin's own claims about what it needs.

## 13. Agent Framework

The Agent Runtime is the technical backbone of the product's Agent Architecture (`PRODUCT_BLUEPRINT.md`). It exists so that adding "Revenue Agent" in v0.2 is a bounded, additive change — a new module implementing a fixed interface — rather than a fork of Mission Control or a rewrite of the AI layer.

**`Agent` interface** (implemented once per agent, e.g. `executive-agent`, `revenue-agent`):
- `id`, `name_en`, `name_ar`, `domain` — identity and display metadata.
- `dataScope` — an explicit, declarative manifest of which domain-module read functions this agent is permitted to call (e.g., Executive Agent: metrics, comparisons, insights, timeline, genome, all report types; a future Finance Agent: metrics filtered to financial keys, open-balance-related timeline events only). This manifest is enforced by the Runtime, not self-policed by the agent's own code — an agent cannot request data outside its declared scope even if its implementation tries to. This is the same manifest shape a third-party Marketplace agent will declare (§19) — internal and future-external agents are one mechanism, not two.
- `allowedRoles` — which HotelOS roles (PRD §1) may access this agent at all; independent from the per-hotel role check already enforced elsewhere, this is agent-level gating (e.g., Housekeeping Agent might exclude Read Only).
- `systemPrompt` / `groundingRules` — agent-specific instructions passed to `ai-orchestration`, always composed with (never replacing) the platform-wide truthfulness rules from the Constitution.
- `frontendRoute` — the agent's own top-level surface within the Mission Control shell (its own screen(s), not a tab bolted onto Executive Agent's UI).

**Agent Registry**: a server-side registration list (not a database table in v0.1 — agents are a deploy-time concept, not a runtime-configurable one, matching the reasoning in Decision D10 for roles) that the Runtime uses to resolve `agentId → Agent` at request time, check `allowedRoles` + hotel membership + `dataScope`, and route the request.

**v0.1 commitment**: the Runtime, the `Agent` interface, and the Executive Agent as its first real implementation all ship in v0.1. Revenue Agent and Front Office Agent get **stub registrations** (visible in the Agent Registry, gated in the UI as "coming soon," proving the interface holds for a second/third agent without building their full data scope yet) — this is the concrete test that the framework isn't just aspirational (see Roadmap).

**Frontend implication**: the Mission Control shell is agent-aware navigation, not a fixed sidebar — it renders available agents for the current hotel/role from the Registry, so a newly shipped agent appears in the shell by registration, not by a shell code change.

## 14. Hotel Timeline Architecture

**`TimelineEvent`** (see `DATABASE_SCHEMA.md` §12 for the table definition) is an append-only, per-hotel chronological log. Every domain module that produces a noteworthy operational moment publishes an event to it: `report.uploaded`, `report.finalized`, `metric.corrected`, `alert.raised`, `alert.resolved`, `recommendation.issued`, `comparison.viewed` (optionally, for high-value comparisons only, to avoid noise), `ai.conversation`, `export.generated`, `decision.logged` (a v0.1 lightweight "executive marked this as a decision" action on a recommendation or insight).

- **Publish, don't poll**: modules call a single `timeline.publish(hotelId, eventType, payload, sourceRef)` function at the point of the state change (e.g., inside the same transaction/flow that finalizes a report) rather than a separate process inferring history after the fact — this keeps the timeline accurate and avoids a second source of truth drifting from the first.
- **Read surface**: the Timeline screen (UX System) is a filtered, paginated, reverse-chronological query over `TimelineEvent` scoped by `hotelId` through the same centralized tenant-scoping layer as everything else (§4) — it is not a special case.
- **Relationship to Audit Log**: deliberately separate from `AuditLog`. Timeline is product-facing operational history (what happened to the hotel, interesting to a GM); Audit Log is compliance/security-facing (who did what, for accountability). Some actions produce both (e.g., report deletion is both an audit event and, arguably, not a timeline event at all — deletions are intentionally excluded from the positive operational narrative and live only in the audit trail). This split is a deliberate design choice, not duplication (see Decisions log).
- **Performance at scale**: `TimelineEvent(hotelId, createdAt)` indexed identically to other hotel-scoped date-driven tables (§16); high-volume hotels don't degrade Mission Control because the timeline is its own paginated read, not embedded inline in every dashboard load.

## 15. Hotel Genome Architecture

**Hotel Genome supersedes and expands the earlier "Hotel Memory" concept** (see `DECISIONS.md` D18) — same underlying mechanism (a retrieval layer over accumulated hotel history), broader ambition: not just "what happened," but the hotel's learned **operational identity** — seasonal behavior, guest patterns, revenue behavior, occupancy behavior, operational strengths/weaknesses, recurring issues, employee performance trends, historical decisions, and AI recommendation outcomes (accepted vs. ignored vs. reversed) — that future agents personalize against instead of reasoning generically. Anywhere earlier material said "memory" or "the `memory` module," read "genome" — the module is renamed (`genome`) as of this revision; no v0.1 code existed under the old name yet (`DECISIONS.md` D18), so this is a documentation rename, not a migration.

- **v0.1 scope — structured genome**: built from the same tables already being written (`HotelMetric` history, `TimelineEvent`, `AIConversation`/`AIMessage`, `Insight`/`Recommendation`) queried with time-range and pattern filters (e.g., "same weekday over the last 8 weeks," "prior instances of this alert category"). No new storage technology required — a disciplined query layer (`genome` module) over data the platform already has, which is why it can ship now rather than waiting for a "real" AI memory system.
- **v0.1 scope — recommendation outcome tracking**: every `Recommendation` gains a lightweight outcome field (accepted / dismissed / superseded, set by the user or inferred from a later related decision) — this is the seed of "AI recommendation outcomes" as a genome input; full outcome-driven personalization is v0.2+, but the field must exist from v0.1 or the historical record needed to power it later is lost.
- **v0.2+ scope — semantic genome**: as history accumulates, storage is extended with a vector index (PostgreSQL `pgvector`, staying inside the existing database) over periodic per-hotel summaries and finalized report content, enabling fuzzier "has this happened before" retrieval beyond exact structured filters. Additive to, not a replacement for, structured genome.
- **v0.3+ scope — behavioral dimensions**: seasonal/guest/employee-performance pattern modeling proper (the parts of the Product Owner's list requiring dedicated analysis beyond simple retrieval) build on top of the v0.1/v0.2 substrate once enough real hotel-history exists to model against — modeling patterns from two weeks of pilot data would be fabrication dressed as insight, which Constitution §4 forbids regardless of how sophisticated the underlying technique is.
- **Truthfulness boundary carries over unchanged**: genome retrieval feeds the AI orchestration context exactly like any other retrieved data (§8) — every genome-derived statement in an agent's response must still cite its underlying source event/report/date (Constitution §4). A richer name for the concept is not license to reason more loosely than a single-report answer; it is more data under the same rules.
- **Provenance and correction**: every genome entry retains a reference back to its source (`TimelineEvent` or `ReportDocument` or `AIConversation`), so a later correction to a metric (PRD §4) is reflected in genome retrieval rather than the genome holding a stale, now-wrong "fact" indefinitely (see §12 memory-poisoning mitigation, renamed genome-poisoning in spirit, same mitigation).
- **Per-hotel isolation, unchanged**: the genome is exactly as hotel-scoped as everything else (§4) — one hotel's genome is never a training signal or retrieval source for another hotel's agent, even in aggregate/anonymized form, without a separate, explicitly-scoped cross-portfolio feature that does not exist in v0.1.

## 16. Enterprise Scale (Design for 1000+ Hotels)

The MVP is small; the architecture underneath it is not allowed to require a redesign to reach roughly 1000 hotels. Concretely, from v0.1:

- **Stateless application tier**: no in-process session or job state; sessions live in the database (or a shared store), so the Next.js/Node app tier can run as multiple horizontally-scaled instances behind a load balancer from day one, not as a single-instance assumption baked into the code.
- **Connection pooling**: PostgreSQL access goes through a pooler (e.g., PgBouncer or the hosting provider's managed pooling) from the start — a 1000-hotel, multi-instance app tier exhausts direct Postgres connections quickly if this is deferred.
- **Real async job processing, not "queue-lite"**: report extraction, PDF generation, and agent AI calls that exceed a synchronous request budget run through an actual job queue (e.g., BullMQ on Redis, or the hosting platform's managed queue) — described as the v0.1 target in the module interfaces (§7, §13) precisely so this isn't a later interface-breaking migration.
- **Caching layer**: Redis (or equivalent) is provisioned from v0.1 for session storage, rate limiting counters, and — as usage grows — Mission Control aggregate caching, even if v0.1's own dashboard queries are fast enough not to need it yet at pilot scale. Provisioning it now means the caching *seam* exists in the code (a cache-aside helper in shared modules) before it's load-bearing.
- **Per-tenant rate limiting and fair-use guards**: API and AI-call rate limits are keyed by `hotelId`, not just by IP/user, so one high-volume hotel or a runaway AI conversation loop cannot degrade the platform for others — a correctness requirement once the platform is genuinely multi-tenant at scale, not just multi-tenant in the schema.
- **Indexing discipline**: every hotel-scoped, date-driven table is `(hotelId, date)`-indexed from v0.1 (Database Schema §10) precisely because adding this correctly after 1000 hotels' worth of data exists is an expensive migration; doing it from the first table is free.
- **Data residency awareness**: Saudi Arabia/GCC hospitality data may carry regulatory or customer-contractual data-residency expectations; the Storage Adapter and hosting choice are kept region-configurable (S3-compatible endpoint + Postgres hosting region are both environment-driven, never hardcoded to a specific provider/region) so a region-appropriate deployment doesn't require an architecture change later — the specific regulatory requirement is flagged as an open question for legal/ownership review, not assumed either way (see Blueprint Risks).
- **Observability at platform scale**: structured application logs and the `audit`/`timeline` modules are designed to be queryable per-hotel and in aggregate across hotels (for the Super Admin / platform operator), so diagnosing "is this one hotel's problem or a platform problem" doesn't require ad-hoc log spelunking once there are hundreds of tenants.
- **What is explicitly deferred**: multi-region active-active deployment, database sharding/partitioning by hotel cohort, and a dedicated read-replica strategy are not built in v0.1 — they are the next lever to pull if/when real load data shows they're needed, and the choices above (stateless tier, pooling, queueing, indexing) are exactly what keeps that lever pullable without a rewrite.

## 17. Event Bus (Domain Events)

The Event Bus is the mechanism that lets future modules — plugins, agents, workflows — react to platform activity **without importing or calling each other directly**. It formalizes what §14's timeline publishing already does, and extends it: a `TimelineEvent` is the durable, user-facing *record* of something happening; a **domain event** is the same moment expressed as a typed message any interested subscriber (internal module, and later plugin/workflow) can react to in-process or asynchronously.

- **v0.1 reality**: the bus is a real, in-process typed pub/sub implemented in `src/server/modules/events` (`publish(event)`, `subscribe(eventType, handler)`), used internally from day one — e.g., the `reports` module publishes `ReportUploaded` and `MetricsExtracted`; the `insights` module subscribes to `MetricsExtracted` to trigger health-score recomputation, rather than the extraction pipeline calling the insights module's function directly. This decoupling is real architecture value now (it's what keeps `report-extraction` from needing to know `insights` exists), not merely future-proofing.
- **Event catalog (v0.1 events, others reserved for when their owning feature ships)**: `ReportUploaded`, `MetricsExtracted`, `MetricCorrected`, `AlertCreated`, `RecommendationGenerated`, `PDFExported`, `AIConversationStarted`. Reserved for later features per the Product Owner's list: `RoomCheckedIn`, `RoomCheckedOut`, `GuestArrived`, `RevenueUpdated` — these belong to PMS-integration and Front Office/Revenue Agent scope (Roadmap v0.2/v0.3) and are declared in the catalog now as documented reservations so their eventual producers and consumers agree on shape in advance, but nothing publishes them yet.
- **Every domain event carries**: `type`, `hotelId`, `occurredAt`, `payload` (typed per event), and `causationRef` (what triggered it, e.g. the `ReportUpload.id`) — this last field is what makes later workflow-engine "trigger chains" (§20) traceable rather than a black box.
- **Delivery semantics (v0.1)**: synchronous, in-process, best-effort — a subscriber failing does not roll back the publisher's transaction (events are for reaction, not two-phase consistency; the source-of-truth write already happened before publish). Moving to at-least-once, durable delivery (e.g., via the Redis-backed queue already provisioned per §16) is the natural v0.2 upgrade when actual external subscribers (plugins) exist — the `publish`/`subscribe` interface is written so that upgrade changes the transport, not every call site.
- **Tenant scoping applies to events too**: every event's `hotelId` is carried through, and a subscriber (including any future plugin) only receives events for hotels it's authorized for — enforced by the same centralized mechanism as everything else (§4), not by trusting a plugin to filter itself.

## 18. Plugin SDK

The Plugin SDK is how third-party and internal teams extend HotelOS **without modifying the core** — the literal requirement behind this section. A plugin is a self-contained package the platform loads, never a fork or a core-code patch.

**Plugin manifest** (declarative, required for every plugin):
- `id`, `name`, `version` (semver) — identity.
- `permissions` — an explicit allow-list of capabilities (which domain-module read/write functions, which event types it may subscribe to, whether it needs outbound network access) — enforced centrally exactly like an Agent's `dataScope` (§13); a plugin cannot silently escalate beyond its declared permissions.
- `dependencies` — other plugins or a minimum HotelOS core version it requires, checked at install time.
- `settings` — a typed (Zod) schema for the plugin's own per-hotel configuration, rendered generically by the core's settings UI rather than each plugin building bespoke settings screens.
- `lifecycleHooks` — `onInstall`, `onEnable`, `onDisable`, `onUninstall`, `onUpdate` — well-defined moments the plugin can act on, run inside the same permission sandbox as its steady-state operation.
- `apiAccess` — which internal API routes (§25) the plugin's backend code may call, scoped the same way agent data-scopes are.
- `uiExtensions` — declared insertion points (e.g., "a card on Mission Control," "a new top-level shell route") the plugin registers into, rather than the plugin injecting arbitrary DOM/route control into the host app.
- `eventSubscriptions` — which domain events (§17) the plugin listens to.

**Core independence, concretely**: the core never imports a plugin's code directly; it loads plugins through the same registration pattern as the Agent Registry (§13) — a plugin registers its manifest and handlers, the core calls them through fixed extension-point interfaces (event handler signature, UI-extension component contract, settings schema contract). A plugin can be removed entirely with zero code change to the core, which is the actual test of "the core remains independent from plugins," not just an aspiration.

**v0.1 reality**: the manifest shape and the permission-enforcement pattern exist as documented interfaces and the underlying enforcement mechanism is the same one already built for hotel-scoping (§4) and agent data-scope (§13) — there is no plugin loader, no plugin installation UI, and no third-party plugin runs in v0.1 (see §26). Building the loader/sandbox before a first real plugin exists to validate the design would be exactly the speculative complexity the Constitution's restraint test warns against.

## 19. Agent Marketplace

Every Agent (§13) is architected as an installable module — the Agent Registry is, in effect, a private, core-team-only marketplace already; this section is what it takes to open that up.

**Marketplace-ready agent metadata** (extending the `AgentDefinition` shape from §13):
- `version` (semver, independent per agent — Revenue Agent v1.2 and Executive Agent v2.0 can ship independently).
- `permissions` — the existing `dataScope`/`allowedRoles`, described in marketplace-facing terms (what hotel data this agent can see, in plain language, for an installing admin to review before enabling it).
- `configuration` — a typed settings schema per agent (e.g., alert thresholds a Finance Agent should use), same pattern as plugin `settings` (§18) — agents and plugins share one configuration mechanism, not two.
- `healthStatus` — a live signal (last successful run, error rate, last AI-provider latency) surfaced per agent so a Hotel Admin can see "this agent is degraded" rather than silently getting worse answers.
- `aiProviderConfiguration` — which `AIProvider` (§8) and model an agent uses, independently overridable per agent (a Housekeeping Agent might reasonably use a cheaper/faster model than the Executive Agent) rather than one global provider setting for the whole platform.
- `knowledgeSource` — which Knowledge Registry entries (§22) this agent is grounded against, in addition to the hotel's own data.
- `updateLifecycle` — how a new agent version is rolled out (a hotel/agent-instance level opt-in, not a forced simultaneous upgrade across every tenant, so a breaking prompt change doesn't surprise a live pilot hotel).

**v0.1 reality**: `AgentDefinition` already carries `id`/`domain`/`allowedRoles`/`dataScope` (§13); this section's additional fields (`version`, `healthStatus`, `aiProviderConfiguration`, `knowledgeSource`, `updateLifecycle`) are the documented target shape the struct grows into as soon as a second agent goes live (v0.2's Revenue Agent, per Roadmap) — they are not implemented against the v0.1 stub registrations because there is nothing yet to version, configure, or report health for. No marketplace UI (browse/install/enable-disable) exists in v0.1 or is planned before real third-party or internal-team agents exist to populate it (see §26).

## 20. Workflow Automation Engine (Architecture Preparation Only)

Per explicit Product Owner direction, **this is architecture preparation, not an implementation target for the current build**. The example workflow (Opera Report Uploaded → Extract Metrics → Executive Analysis → Generate PDF → Send WhatsApp → Email GM → Archive) describes a chain of domain events (§17) with side effects — which is exactly why the Event Bus was designed first: a future visual workflow builder (Zapier/n8n-style) is fundamentally "let a user wire event triggers to action steps without writing code," and that only works if events already exist as a clean, typed, subscribable surface.

**What v0.1 does to stay ready without building the engine**:
- Every meaningful state transition in the core workflow (§3, and the narrower v0.1 scope in §26) is already expressed as a domain event with a `causationRef` (§17) — the raw material a workflow engine would trigger on already exists as a byproduct of building the product correctly, not as extra work done "for" the future engine.
- No workflow data model (trigger/action/condition graph, execution history, visual builder state) is built in v0.1 — designing that schema well requires knowing real user-requested automation patterns, which don't exist yet from zero pilot hotels.
- The `NotificationProvider` interface (Architecture §5/D9) is already provider-abstracted (mock today, real email/SMS/WhatsApp later per Roadmap v0.2) specifically because a future "Send WhatsApp" workflow action is just another `NotificationProvider` implementation invoked by the (future) engine — not a special case bolted on later.
- **Explicitly not built**: any workflow execution runtime, trigger/action UI, or automation persistence. This is the clearest example in this document of "prepare the seam, do not build the room" (see §26).

## 21. Prompt Registry

Every AI prompt HotelOS sends to a provider is a **versioned, registered artifact**, never an inline string buried in application code — required so future AI behavior "must never depend on hidden prompts" (Product Owner directive), and a direct extension of the truthfulness discipline already required of `ai-orchestration` (§8).

**Prompt record shape**:
- `id`, `owner` (team/person accountable for its content), `version` (semver or incrementing integer, immutable once published).
- `language` (a prompt is authored per language, not machine-translated at runtime, matching the Constitution's "Arabic-first, not Arabic-added" principle applied to AI behavior).
- `modelCompatibility` (which provider/model family it's validated against — a prompt tuned for one model is not silently reused against another without review).
- `variables` (a typed list of the interpolation slots the prompt accepts — e.g., `{metricsSummary}`, `{hotelName}` — validated at render time so a missing variable fails loudly, not with a malformed prompt sent to the provider).
- `approvalStatus` (draft / approved / deprecated) and `changeHistory` (who changed what, when, and why) — this is what makes "never hidden" concrete: any prompt in production has a reviewable trail.

**v0.1 reality**: `ai-orchestration` (§8) already needs a system prompt and grounding rules for the Executive Agent (§13) — in v0.1 these are implemented as versioned constants in `src/server/modules/ai-orchestration/prompts/` (file per prompt, with the fields above as a header comment/metadata block and the actual prompt text as the body), checked into source control so `changeHistory` is literally git history in v0.1. This satisfies "version-controlled, never hidden" without requiring a database-backed registry UI before there's more than one or two prompts to manage. A DB-backed registry with an approval workflow UI is the natural v0.2+ evolution once the number of prompts (across multiple agents) makes file-based management unwieldy — the metadata shape above is designed so that migration is a storage change, not a schema redesign.

## 22. Knowledge Registry

Each Agent (§13, §19) is grounded not only in the requesting hotel's own data (§8, §15) but potentially in a **domain knowledge source** independent of any single hotel — e.g., a Front Office SOP reference, a Housekeeping standard, general revenue-management practice. The Knowledge Registry is what makes those sources swappable without touching agent logic.

- **`KnowledgeSource` shape**: `id`, `domain` (matches an `Agent.domain`, e.g. `revenue`, `front_office`), `title`, `content` or `storageKey` (for larger documents), `language`, `version`, `status` (active/deprecated).
- **Consumption pattern**: an agent's `knowledgeSource` field (§19) references zero or more `KnowledgeSource` entries; `ai-orchestration` retrieves and includes them in the grounded context the same way it includes hotel-scoped data — subject to the identical citation rule (Constitution §4): a statement grounded in a knowledge source, not hotel data, must be distinguishable from a hotel-specific fact in the agent's response (this is a natural extension of the existing fact/calculation/recommendation split, PRD §8).
- **Replaceability, concretely**: swapping a hotel's Front Office SOP reference for an updated version is a `KnowledgeSource` write, not a code change or redeploy — the requirement that "knowledge sources must be replaceable without changing application logic" is satisfied by knowledge never being compiled into agent code or prompts, only referenced by id.
- **v0.1 reality**: the Executive Agent in v0.1 is grounded only in hotel-specific data (metrics/timeline/genome) — it has no generic domain-knowledge dependency yet, so no `KnowledgeSource` rows are populated and no UI exists to manage them. The shape above is documented now so that when a Revenue or Front Office Agent (v0.2/v0.3, Roadmap) needs domain SOP grounding, it plugs into an existing pattern instead of inventing a one-off mechanism.

## 23. Observability

Enterprise observability is prepared for, not fully instrumented, in v0.1 — proportionate to having one real workflow and a handful of pilot hotels rather than production load across hundreds of tenants.

- **Structured logs (v0.1, real)**: every server-side log line carries a consistent shape (`timestamp`, `level`, `hotelId` where applicable, `userId` where applicable, `route`/`module`, `message`, structured `context` object) — this is a logging *convention* enforced by a shared logger helper (`src/lib/logger.ts`), not a new infrastructure dependency, and it's what makes the audit/timeline modules' "queryable per-hotel and in aggregate" requirement (§16) achievable without ad-hoc grepping.
- **AI execution logs (v0.1, real)**: every `ai-orchestration` call logs provider, model, prompt id+version (§21), token usage, latency, and success/failure — without ever logging the raw hotel data sent as context (that data's sensitivity means it belongs in the AI conversation's own record, `AIMessage`, governed by the same access rules as everything else, not in general-purpose logs).
- **Tracing (prepared, not wired in v0.1)**: the module-boundary discipline already required by §2 (explicit function calls between modules, not ad-hoc cross-imports) is exactly what makes adding distributed tracing (e.g., OpenTelemetry spans around module-boundary calls) additive later rather than requiring a refactor — no tracing SDK is integrated in v0.1, since a single-process modular monolith with one real workflow doesn't yet produce the kind of cross-service trace complexity tracing exists to untangle.
- **Metrics (prepared, not wired in v0.1)**: the same per-module-call discipline is the seam for future application-level metrics (request latency, extraction job duration, AI call cost) via a metrics library/APM agent — deferred until real usage data justifies the operational overhead of running one.
- **Workflow logs / plugin logs (prepared only)**: reserved log categories and the `causationRef` field on domain events (§17) are what a future workflow engine's or plugin's execution history would be built from — no such logs exist in v0.1 because no workflow engine or plugin runtime exists yet (§20, §18).

## 24. API-First

Every business capability HotelOS exposes to its own Web UI is defined as a clean, internally-documented API — the Web UI is a consumer of that API, not a special client with privileged direct access to server internals a future mobile app or integration wouldn't have.

- **v0.1 approach**: Next.js Server Actions and Route Handlers under `src/app/api/` both call the same underlying domain-module functions (§2) — the module layer *is* the API contract; Server Actions are simply the Web UI's transport for it. This keeps v0.1 pragmatic (no separate API server to stand up before there's a second consumer) while keeping the actual API-first discipline: no domain logic lives inside a Server Action or route handler that a future mobile client couldn't also reach by calling the same module function through a route handler.
- **v0.2+ evolution**: as a second real consumer emerges (mobile app, a Marketplace plugin's backend, an external integration), the route-handler surface under `src/app/api/` is formalized (versioned, OpenAPI-documented, authenticated via token rather than only session cookie) without the underlying module functions changing — because they were never coupled to the Web UI's transport in the first place.
- **Authorization is API-layer, not UI-layer, from v0.1**: every route handler and Server Action independently re-derives the caller's session/role/hotel-scope (§4, §5) — a mobile client hitting the same endpoint gets the identical enforcement a browser session gets, which is the concrete test of "the Web UI consumes the same APIs future clients will."

## 25. Platform Extension Points Summary

A single reference table for where new capability plugs in, so "does this belong in core or as an extension" has one place to check:

| Extension point | Registers via | Enforced by | v0.1 status |
|---|---|---|---|
| New Agent | Agent Registry (§13) | `requireAgentAccess` data-scope check | Executive Agent live; Revenue/Front Office stubbed |
| New Plugin | Plugin manifest (§18) | Same permission-enforcement pattern as §4/§13 | Interface documented; no loader/runtime |
| New domain event reaction | `events.subscribe` (§17) | Tenant-scoped delivery (§4) | Real, used internally |
| New UI surface | Plugin `uiExtensions` (§18) / Agent `frontendRoute` (§13) | Agent-aware shell rendering (§13) | Agent routes real; plugin UI extensions documented only |
| New workflow automation | Future workflow definition consuming events (§20) | Not yet built | Architecture-only |
| New AI prompt | Prompt Registry entry (§21) | Version/approval metadata | File-based registry, real |
| New knowledge domain | `KnowledgeSource` (§22) | Agent `knowledgeSource` reference | Schema documented; unpopulated |

## 26. Platform Maturity Map (v0.1 Reality Check)

Required reading before assuming any capability above is usable — this is the concrete application of Constitution §2 rule #1 ("no feature ships claiming to work unless genuinely implemented") to this document itself.

**Real, working code in v0.1**: authentication/sessions, centralized hotel-scoping, audit log, Hotel Timeline (publish + read), the in-process Event Bus (internal subscribers only), the Agent Registry and Executive Agent gating, file-based Prompt Registry for the Executive Agent's own prompts, structured logging convention, Server-Action-as-API pattern.

**Documented interface, no runtime yet**: Plugin SDK manifest/loader, Agent Marketplace metadata beyond the base `AgentDefinition`, Knowledge Registry storage and UI, database-backed Prompt Registry with approval workflow, distributed tracing/APM, formalized/versioned external API surface.

**Explicitly not started, by Product Owner direction**: Workflow Automation Engine (any runtime, persistence, or UI), Plugin Marketplace UI, Agent Marketplace UI, third-party plugin or agent execution of any kind.

Nothing in this document authorizes UI, marketing copy, or sales material to imply a capability from the second or third tier is available today. As each moves into the first tier, this section must be updated in the same change that ships it (see `DECISIONS.md` for the discipline that keeps this honest).

**This tier list is extended by §33 (Data Quality Engine, moves to tier 1 with M3) and stays otherwise unchanged by §27–§36 below** — those sections are almost entirely tier 2 (documented) or tier 3 (not started) by design; see each section's own maturity statement.

## 27. Bounded Context Map (Domain-Driven Design)

The domain-module structure already established (§2) *is* HotelOS's DDD implementation — each module owns its Prisma models as its aggregate/domain model and is reached only through its exported interface, never by another module reading its tables directly. This section makes the **bounded contexts** explicit by grouping modules under the business capability they serve, which is what DDD adds on top of "just modularity": a shared vocabulary boundary, not only a code boundary.

| Bounded Context | Owning module(s) | Status |
|---|---|---|
| **Identity** | `auth`, `users`, `memberships`, `roles-permissions` | Live |
| **Hotels** | `hotels`, `settings`, `subscriptions` | Live |
| **Reports** | `reports`, `report-extraction` | Live (upload); extraction is M3 |
| **Metrics** | `metrics`, `comparisons` | M4 |
| **Executive Intelligence** | `insights`, `timeline`, `genome`, Executive Agent | Partial (timeline/genome scaffolding live; insights is M5) |
| **Revenue** | Revenue Agent (+ its own future data-scope slice of `metrics`) | Registry stub only |
| **Front Office** | Front Office Agent | Registry stub only |
| **Housekeeping** | Housekeeping Agent (not yet registered) | Not started |
| **Finance** | Finance Agent (not yet registered) | Not started |
| **AI Platform** | `ai-orchestration`, `events`, Prompt Registry, Knowledge Registry | Scaffolded (events live; ai-orchestration is M6) |
| **Automation** | Workflow Automation Engine | Architecture-only (§20) |
| **Notifications** | `NotificationProvider` (D9) | Mocked/logged only |
| **Audit** | `audit` | Live |

**A bounded context can span multiple modules** (Identity is four modules) **or be smaller than one module** (Revenue is a slice of `metrics` plus its own agent, not a module of its own yet) — the context is the business-meaning boundary; the module is the code boundary. They're kept aligned deliberately (§2's rule that cross-module access goes through exported interfaces is exactly what keeps a bounded context's internal model private from other contexts), but a context does not have to become "one module" the day it's named — Revenue and Front Office are contexts named today and implemented incrementally (Roadmap v0.2), consistent with D12's agent-framework-before-agents sequencing.

**What this changes about existing code**: nothing, retroactively — no file-tree rename in v0.1 (see `DECISIONS.md` D23 for why a rename with zero functional benefit right now would itself violate the restraint principle this whole document keeps invoking). New modules from M3 onward are built with their bounded context in mind from the start.

## 28. CQRS Readiness

Full CQRS (separate read/write models, separate datastores or projections) is not built in v0.1 — one Postgres database, one Prisma schema, same tables for reads and writes, exactly as a modular monolith at this scale should look. What *is* adopted now, because it costs nothing and pays off directly when/if a real split is ever needed, is a **naming and file-organization convention**:

- Within each domain module, write operations (**commands** — they change state, are named as imperatives: `uploadReport`, `correctMetric`, `markRecommendationOutcome`) and read operations (**queries** — they return state, named as retrievals: `listReportUploads`, `findSimilarWeekdayHistory`) are exported as distinct functions, and for modules with more than a couple of each, live in separate `commands.ts` / `queries.ts` files rather than one `service.ts`.
- Callers (Server Actions, route handlers, other modules) call commands and queries as unrelated function calls — never a query that secretly mutates, never a command that returns a large read-optimized payload "for convenience." This is what actually keeps the future split cheap: a query function can be repointed at a read replica or a denormalized projection later without the caller's code changing, because it was never coupled to the command path's transaction to begin with.
- **v0.1 reality**: `src/server/modules/reports` is organized this way from M3 onward (`commands.ts` for `uploadReport`, `queries.ts` for `listReportUploads`) as the first applied instance of the convention. Earlier M1–M2 modules (`auth`, `timeline`, `genome`) already happen to follow the same command/query naming discipline without the file split, since they're small enough that one file is clearer — the convention scales the file organization, not the naming discipline, which applies everywhere already.
- **Explicitly not built**: no CQRS event-sourcing, no separate read database, no denormalized projections. That is real infrastructure with real operational cost, justified only by a real read/write scaling mismatch this platform does not have yet.

## 29. Feature Flags

Every major module/context (§27) can be enabled or disabled per hotel — required for future Enterprise customers who license only a subset of the platform, and implemented as real, working code in v0.1 because it's cheap (it reuses `HotelSetting`, already in the schema) and it's needed immediately (the Agent Registry's "coming soon" stubs are, functionally, a feature flag already; this formalizes that into one mechanism instead of two).

- **Mechanism**: `src/server/modules/feature-flags` exposes `isModuleEnabled(hotelId, moduleKey)`, backed by a `HotelSetting` row (`key: "enabled_modules"`, `value: string[]`) with a hardcoded default list per module (v0.1 core contexts default **on**; unbuilt agent contexts default **off** until their full implementation ships, at which point a hotel's Super Admin/Hotel Admin can toggle them).
- **Enforcement point, not decoration**: `moduleKey` checks are called from the same centralized places that already enforce hotel-scoping and role permission (§4, §13) — a disabled module returns "not available for this hotel" the same way an out-of-scope hotel access does, rather than each screen independently remembering to check.
- **v0.1 reality**: wired into the Agent Runtime (an agent's registry entry now also requires `isModuleEnabled(hotelId, agent.domain)`) and into the Reports upload path (`reports` module checked before an upload is accepted) as the two concrete proof points that the mechanism is real, not aspirational. No admin UI to toggle flags exists yet — flags are set via direct `HotelSetting` writes (Super Admin tooling to manage this is Roadmap v0.2, alongside the Hotel Admin/Super Admin consoles that don't exist yet either).

## 30. AI Orchestration Layer

**AI never calls a business/domain module directly.** Every AI interaction — today just the future Executive Agent, later every agent — goes through `ai-orchestration`, which is the only module permitted to call an `AIProvider` (§8). This was already the architecture's intent (§8 originally); this section makes the internal responsibilities of that layer explicit, since a Product Owner directive naming them individually is the appropriate moment to stop leaving them implicit.

`ai-orchestration` owns, internally, a fixed pipeline every agent request passes through:

1. **Retrieval** — fetch the hotel-scoped data (metrics, timeline, genome) and any Knowledge Registry entries (§22) the requesting agent's `dataScope`/`knowledgeSource` (§13, §19) permits. This is the *only* place agent code touches raw data — an agent's own code never issues its own Prisma queries against another context's tables (§4, §27 both apply here too).
2. **Prompt selection** — resolve the correct Prompt Registry entry (§21) for the agent, language, and task, never an inline string.
3. **Tool calling** — if the provider/model supports function-calling, the tool surface offered is itself scoped to the requesting agent's `dataScope` (an agent cannot be handed a tool that reaches outside its declared permissions, mirroring §13's enforcement).
4. **Reasoning** — the provider call itself (via `AIProvider.complete`, §8).
5. **Validation** — the raw model output is checked against the truthfulness contract (Constitution §4) before it reaches a user: does every factual claim have a retrievable source? Is missing data stated as missing rather than glossed over? A response failing validation is not shown as-is (retried with tighter grounding, or surfaced as a graceful "couldn't produce a grounded answer" — never silently relaxed).
6. **Citations** — sources used are attached to the response in a structured form (`AIMessage.citedSources`), not just mentioned in prose, so the UI can render them as clickable references.
7. **Response formatting** — the fact/calculation/recommendation structural split (PRD §8) is applied here, consistently, regardless of which agent or provider produced the raw output.
8. **Multi-model routing (future hook, not built)** — `AIProvider` selection is already per-agent-configurable (§19 `aiProviderConfiguration`); routing logic that picks a model dynamically (by cost, task complexity, or failover) is a natural extension of step 4 that plugs in without changing steps 1–3 or 5–7, but no such routing logic exists in v0.1 with a single configured provider.

**v0.1 reality**: this entire layer is still M6 scope (Roadmap) — the Executive Agent's AI Q&A isn't built yet. This section exists now so that when M6 starts, the pipeline shape is already decided and reviewed, rather than invented under the time pressure of "just make the AI answer questions."

## 31. Decision Engine

HotelOS's actual product shape, restated as a pipeline, per Product Owner framing: **Data → Metrics → Insights → Recommendations → Priorities → Decisions → Actions.** Every stage maps to an existing or planned entity, and every recommendation is traceable end-to-end through it — the pipeline is not a new subsystem, it's the existing data model read as a chain:

| Stage | Entity | Status |
|---|---|---|
| Data | `ReportUpload` / `ReportDocument` (raw) | Live |
| Metrics | `HotelMetric` (normalized) | M4 |
| Insights | `Insight` (health score + factors) | M5 |
| Recommendations | `Recommendation` (risk/opportunity/action, with `priority`) | M5 |
| Priorities | `Recommendation.priority` | M5 (already a field, §DB) |
| Decisions | `TimelineEvent` (`decision_logged`) — a user explicitly marking a recommendation acted-on or rejected | M5/M6 (event type already reserved in schema) |
| Actions | Action Center (§32) | Architecture-only |

**Traceability, concretely**: a `Recommendation` carries `insightId → Insight`; an `Insight` is generated from `HotelMetric` rows for a date; each `HotelMetric` carries `sourceReportDocumentId`. Following that chain backward from any recommendation reaches the original uploaded PDF — this is the existing schema's provenance discipline (Database Schema §11, Architecture §15 "Provenance") restated as the thing that makes "every recommendation traceable" true by construction, not by a new tracking mechanism bolted on top.

## 32. Action Center (Architecture Preparation Only)

Per the same "prepare, don't build" instruction pattern as the Workflow Automation Engine (§20) and consistent with `DECISIONS.md` D20's reasoning against unpopulated scaffolding: **no schema or code ships in v0.1.** The future `Action` entity is documented here so it plugs into the existing Recommendation/Decision chain (§31) without redesign when it is built:

- `Action`: `id`, `recommendationId → Recommendation`, `assignedToUserId`, `dueDate`, `status` (open/in_progress/done/verified), `completedAt`, `completedByUserId`, `verifiedAt`, `verifiedByUserId`.
- Relationship to the Decision Engine (§31): an Action is what a Decision becomes once someone is accountable for doing it by when — the natural next link in the chain, deliberately not built until Recommendations (M5) exist to attach it to.
- Relationship to the Workflow Automation Engine (§20): a future workflow's action step ("assign to Front Office Manager") and a manually-created Action are the same entity created two different ways — one more reason to design the shape once, now, even while deferring the build.

## 33. Data Quality Engine

Unlike §29–§32, **this is real, v0.1 code, landing with M3** — it is directly load-bearing for the extraction/validation stage already on the Roadmap, not a future capability.

Every `ReportDocument` receives, at the validate stage of the processing pipeline (PRD §4):
- `completenessScore` (0–1) — the fraction of expected fields for this report type that were successfully extracted with a value, vs. left unavailable.
- `confidenceScore` (0–1) — the extraction adapter's own confidence in the values it found (already declared in the schema as `extractionConfidence`; this section is what actually populates it with a real methodology instead of a placeholder).
- `validationStatus` (`passed` / `flagged` / `failed`) — the outcome of the plausibility checks already required by PRD §4 (e.g., rooms sold ≤ rooms available), computed, not asserted.
- `qualityNotes` — a structured list of which specific fields were low-confidence, missing, or failed validation, surfaced directly in the manual-review UI so a user knows what to check first, not just that "something" needs review.

**Why this matters beyond the review screen**: per Product Owner direction, "AI must use these scores when generating recommendations" — when the Executive Agent (M6) reasons over a report's metrics, low completeness/confidence is part of the grounding context, not hidden from the model. A recommendation built on a 40%-complete report must be able to say so (Constitution §4's "state clearly when data is missing" already required this in spirit; Data Quality scores make it a queryable fact instead of an implicit gap the AI would otherwise have to infer).

**Scoring methodology is transparent by the same discipline as the Health Score** (§DB, Architecture reference to Database Schema `Insight.healthScoreFactors`): `qualityNotes` is the auditable breakdown, not just a number — this is a deliberate consistency, not a coincidence; a product whose motto is "never invent missing values" cannot have an opaque quality score any more than it can have an opaque health score.

## 34. Future Digital Twin (Reserved Extension Point Only)

Per explicit Product Owner direction: **no implementation, no schema, no module in v0.1 or any currently-scheduled version.** A future Hotel Digital Twin — simulating occupancy, staffing, and revenue scenarios — would consume the Hotel Genome (§15) and the Metrics history as its primary inputs, and would be a new bounded context (§27) of its own, likely named **Simulation**. The only thing reserved today is the *awareness* that this is a plausible future consumer of Genome data, which is one more reason (alongside the Executive Agent's own grounding needs) that the Genome's provenance and structured-query discipline (§15) is worth getting right now rather than later. Nothing else is reserved — no placeholder tables, no stub module, no naming convention pre-committed — because there is nothing yet to design correctly against.

## 35. Performance Budget

Measurable targets, not aspirations — these are the numbers a build is checked against once there's a real deployment to measure, and the numbers M3 onward should be built with in mind:

| Dimension | Target | Notes |
|---|---|---|
| Cold start (server process ready) | < 3s | Node process boot to accepting requests; relevant for serverless/container restart scenarios |
| Dashboard load (Mission Control, cached/typical data) | < 2s interactive | Already stated in Constitution §8; restated here as the anchor for the rest of this table |
| AI response (first token / first meaningful content) | < 4s | Beyond this, a loading state must communicate real progress (Constitution §9's "no dead ends" applied to AI latency specifically), not a bare spinner |
| PDF generation (executive export) | < 8s | Server-side generation; async with progress indication if it exceeds ~3s in practice |
| Upload processing (extraction pipeline, per report, Manager Flash) | < 15s end-to-end to "ready for review" | Matches the `upload → extract → validate → normalize` stages being visibly staged (PRD §4) rather than one opaque wait |
| Memory usage (app server, steady state, per instance) | < 512MB | Sets the baseline container sizing assumption for the stateless-tier scaling story (§16) |
| Bundle size (client JS, first load) | < 150KB gzipped for Mission Control | Current v0.1 shell measures ~87KB first-load JS (see build output) — headroom exists but is not unlimited as agent-specific UI is added |

**v0.1 reality**: these are targets, not yet continuously measured — no APM/metrics pipeline is wired in (§23 marks this "prepared, not wired"). The build-output bundle-size number is checked manually today (`npm run build` output); automated performance regression testing is a Roadmap v0.2+ item once there's a CI pipeline and real usage data to calibrate alerting thresholds against, rather than picking arbitrary thresholds now that would either be ignored or falsely alarm.
