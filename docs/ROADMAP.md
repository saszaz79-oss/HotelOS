# HotelOS Roadmap

## v0.1 — MVP: One Production-Quality Workflow, on a Platform Foundation

**Explicit Product Owner direction (this revision): do not expand v0.1 scope.** The deliverable is ONE complete, production-quality workflow — `Opera PDF Upload → Validation → Metric Extraction → Normalization → Mission Control Dashboard → Executive AI Analysis → Professional Executive PDF Export → Archive` — built on top of the platform foundation (multi-tenancy, Agent Runtime, Hotel Timeline, Event Bus, Hotel Genome substrate, file-based Prompt Registry) so the *next* workflow and the *next* agent are additive, not a rewrite. Full detail in `MVP_PRD.md`, `PRODUCT_BLUEPRINT.md`, and `ARCHITECTURE.md` §13–26.

**Quality over quantity, concretely**: Revenue Agent, Front Office Agent, and every other agent beyond Executive Agent get **only** their registry stub (id/metadata, "coming soon" in the shell nav) — no further work on them until the core workflow above is genuinely production-quality (real extraction accuracy validated against real reports, real AI grounding, a PDF export a GM would actually hand to ownership). Plugin SDK runtime, Agent Marketplace UI, and Workflow Automation Engine UI are **not built at all** in v0.1 — only their architectural seams (Architecture §18, §19, §20, §26).

**Milestones**
- M0: Phase 0 documentation complete and approved, including the OS/Agent/Timeline/Genome pivot and this platform-architecture revision. *(done)*
- M1: Application shell as an **agent-aware Mission Control shell**, i18n/RTL, auth, multi-tenant model built on the enterprise-scale foundations (Architecture §16), DB schema/migrations, seed data, audit logging skeleton. *(done)*
- M1.5: **Agent Runtime** (`Agent` interface, Registry, permission/data-scope enforcement), **Timeline** (`timeline.publish` + read surface), **Event Bus** (in-process `publish`/`subscribe`, Architecture §17), the **Hotel Genome** module's structured scaffolding, and **Feature Flags** (`isModuleEnabled`, Architecture §29) — built before any agent-specific or workflow-specific feature, since everything downstream consumes these rather than re-implementing scoping/eventing/flagging per feature. *(done)*
- M2: **Report Upload** — storage adapter, upload UI, `ReportUpload`/`ReportDocument` creation, checksum-based duplicate detection, `ReportUploaded` event published (Architecture §17). *(done)*
- M3: **Validation + Metric Extraction** — the Manager Flash adapter first (highest-value daily report), `ExtractionJob` stage tracking (`upload → extract → validate`), generic fallback adapter, **Data Quality Engine scoring** (completeness/confidence/validation status/quality notes, Architecture §33 — real in this milestone, not deferred), manual-review UI for flagged/uncertain fields that surfaces those quality notes directly. *(done)*
- M4: **Normalization** — confirmed values write to canonical `HotelMetric` rows; `MetricsExtracted` event published; duplicate/replacement handling finalized. *(done)*
- M5: **Mission Control Dashboard** — real metrics rendering, transparent Health Score methodology, today-vs-yesterday comparison, replacing the honest-empty-state placeholder. *(done — delivered together with M4, M6, and the Decision Engine at the Product Owner's request; see "Executive Mission Control" milestone in session history)*
- M6: **Executive AI Analysis** — Executive Agent one-shot Executive Summary grounded in real stored metrics **and Data Quality scores**, through the AI Orchestration pipeline (retrieval → prompt selection → reasoning → validation → citations → formatting, Architecture §30), file-based versioned prompts (Architecture §21). *(done, narrower than originally scoped — a single grounded summary, not yet multi-turn Q&A/conversation persistence; that remains open, see "Validation Phase" below)*
- **Validation Phase (required gate — see `VALIDATION_REPORT.md`, `PARSER_DOCUMENTATION.md`)**: per explicit Product Owner direction, no further roadmap milestone (including M7/M8 below and all of v0.2+) proceeds until the extraction pipeline, normalization, Health Score, and Decision Engine are demonstrated reliable on **real** Opera operational data — not just synthetic test data. Delivered as of this revision: the Validation Workspace (`/validation`, Super Admin only), per-field validation status (verified/needs_review/unsupported/missing/ambiguous) with source page/snippet tracing, the Data Quality Dashboard, Real Data Mode ground-truth/accuracy-comparison infrastructure, full timeline traceability (every event resolves to its real related entity, not just its parent Insight), Parser Documentation, and an honest Validation Report. **What remains before the gate actually clears**: real Opera Manager Flash samples must be obtained and run through Real Data Mode to produce a measured accuracy figure — see `VALIDATION_REPORT.md` §7 for the prioritized next steps. This gate is a standing item, not a milestone with a fixed number, until that evidence exists.
- M7: **Professional Executive PDF Export** (AR/EN) — server-side generation, `PDFExported` event, archive linkage. **Blocked by the Validation Phase gate above.**
- M8: **Archive** — filterable view across uploads, analyses, and exports; re-run analysis; permissioned delete with audit trail. **Blocked by the Validation Phase gate above.**
- M9: Quality gates pass end-to-end (Constitution §10), including tenant-isolation tests on the Agent Runtime and the report/metrics data-access layer specifically; README/env/Docker/deployment docs finalized against the one shipped workflow.

**Dependencies**: M2–M8 are a strict sequential chain — each stage's output is the next stage's input, matching the workflow itself; none of M2–M8 starts before M1.5's Event Bus and Genome scaffolding exist, since every stage publishes events and feeds the genome from its first version rather than retrofitting that later (the same reasoning as the original Timeline-from-day-one decision, D13).

**Validation plan for v0.1**: pilot with a small number of real independent hotels in Saudi Arabia, feeding real (anonymizable) Opera exports, measuring extraction accuracy on the Manager Flash adapter specifically (the only fully-built adapter this revision targets), time-to-reviewed-report, whether GMs return to Mission Control daily without prompting, whether the Timeline is used for scroll-back, and whether the executive PDF export is good enough to actually hand to ownership without manual touch-up — that last bar is the concrete meaning of "production-quality" for this milestone.

## v0.2 — Remaining Adapters, Second and Third Agents, Depth and Trust

- **Remaining Opera report adapters**: Reservation Statistics, Open Balance, Reservation Statistics 1 — deliberately moved out of v0.1 by this revision so Manager Flash extraction reaches real production quality first, rather than four adapters at mediocre quality simultaneously.
- **Revenue Agent**: full implementation on the v0.1 Runtime — ADR/RevPAR trend intelligence, rate/segment analysis, its own frontend surface within the shell. The concrete test of whether the Agent Framework investment paid off.
- **Front Office Agent**: full implementation — arrivals/departures/stayovers, today's operational load, scoped to Front Office Manager role by default.
- **Finance Agent**: begins here (open balance, ledger, cash/card reconciliation intelligence) — pairs naturally with the Open Balance adapter also landing in v0.2.
- Comparison Center beyond today-vs-yesterday (period-over-period, hotel-vs-hotel) — deliberately trimmed from v0.1's single workflow focus.
- Semantic genome layer (pgvector-based retrieval per Architecture §15) once enough hotel history exists across pilot hotels for pattern retrieval to be meaningful rather than speculative.
- Durable, at-least-once Event Bus delivery (Architecture §17) once a first real external subscriber (an early plugin or the workflow engine prototype) needs it — v0.1's in-process best-effort bus is sufficient while every subscriber is internal.
- Database-backed Prompt Registry with an approval workflow UI, replacing v0.1's file-based registry once there are enough prompts across multiple agents to justify it (Architecture §21).
- Metric value history/versioning (beyond single-row correction) if pilot usage shows a need for full audit trails on corrections.
- Alert threshold configuration per hotel (currently fixed logic in v0.1).
- Group/portfolio-level rollup Mission Control for Super Admin / multi-property owners — a natural extension of the agent-aware shell to a "fleet view" across hotels.
- Notification delivery (real email, and evaluate SMS/WhatsApp given GCC usage patterns) replacing the v0.1 mocked reset-token delivery — also what a future "Send WhatsApp" workflow action (Architecture §20) will build on.
- Materialized/cached comparison aggregates and the Redis-backed caching seam from Architecture §16 activated in earnest, if data volume makes on-demand computation a measured bottleneck.
- First real load/scale validation pass against the Architecture §16 enterprise targets (stateless tier under load, connection pooling headroom, queue throughput) — not waiting until 1000 hotels to find out if the design holds.

## v0.3 — Full Agent Family + Connected Intelligence

- **Housekeeping Agent** and **Maintenance Agent**: full implementations — room status/turnover operations and out-of-order/out-of-inventory root-cause tracking respectively.
- **Sales Agent**: full implementation — group/contract and segment performance.
- Direct PMS integration (Opera Cloud API) as an alternative/complement to PDF upload — reduces manual export step where hotels are willing to grant API access, and becomes a richer input to the Hotel Genome than periodic PDF uploads alone.
- OTA data ingestion (rate/availability parity signals) as an additional insight input, consumable by the Revenue Agent primarily.
- Forecasting (demand/occupancy projection) building on the by-then-mature Hotel Genome and metrics history — this is where semantic genome retrieval starts directly informing agent output, not just answering "has this happened before."
- Behavioral genome dimensions proper (seasonal pattern modeling, employee performance trends, recommendation-outcome-driven personalization) — the parts of the Hotel Genome concept requiring real accumulated history to model honestly (Architecture §15).
- Expanded AI capability: proactive daily briefing generation (Executive Agent drafts the morning summary rather than only answering questions), still bound by the same truthfulness rules; cross-agent orchestration (e.g., Executive Agent surfacing a Revenue Agent finding) becomes viable once multiple agents have real data scopes to draw from.
- Distributed tracing/APM wired against the module-boundary seams already in place (Architecture §23), once cross-module call complexity justifies it.

## v0.4 — Platform Opens: Plugin SDK, Agent Marketplace, Workflow Automation

This is where the platform vision (`PRODUCT_BLUEPRINT.md` Platform Vision, Architecture §18–§20) becomes real runtime, not just documented interface — sequenced last, after the internal agent family (v0.2/v0.3) has exercised the underlying permission/data-scope/versioning patterns enough to trust opening them to third parties.

- **Plugin SDK runtime**: manifest loader, permission sandboxing, plugin installation/enable/disable UI, lifecycle hook execution.
- **Agent Marketplace UI**: browse/install/configure/health-monitor agents, including third-party ones, on top of the Agent Registry pattern already in place since v0.1.
- **Workflow Automation Engine**: visual trigger/action builder over the Domain Event Bus (durable delivery from v0.2), execution history, the concrete realization of the Opera-Upload-to-WhatsApp example workflow from the platform-evolution directive.
- Durable, versioned external API (Architecture §24) formalized once real external consumers (plugins, mobile, integrations) exist to consume it.

## Future Integrations (directional, unscheduled)

- **Action Center** (Architecture §32) — turns Recommendations into assigned, due-dated, verifiable tasks; the natural v0.4-adjacent companion to the Workflow Automation Engine once Recommendations (M5) exist to attach actions to.
- **Hotel Digital Twin** (Architecture §34) — occupancy/staffing/revenue scenario simulation over the Hotel Genome; reserved conceptually only, no scheduled version.
- Rate/revenue-management recommendation engine within the Revenue Agent (moves from "insight" to "suggested action with projected impact").
- Staff task assignment from alerts, likely surfaced through the Front Office and Housekeeping Agents (turn a risk into an assigned, trackable task) — this is what the Action Center becomes once built.
- Guest review/sentiment integration as an additional data source for the health score and a future Sales/Guest-Experience agent.
- Native app-store packaging (the PWA/architecture choices in v0.1 are made specifically not to block this).
- Billing/subscription self-serve flow on top of the `Subscription`/license schema reserved since v0.1.
- Multi-region active-active deployment and database sharding/partitioning by hotel cohort — the levers explicitly deferred in Architecture §16, pulled only if real load data shows they're needed.

## Non-Goals Reminder

Anything not listed above and not in the v0.1 MVP scope (see `PRODUCT_BLUEPRINT.md` Non-Goals) is explicitly out of scope until re-evaluated against real pilot feedback — HotelOS grows by validated demand, not speculative breadth (Constitution §1, restraint test). The Agent Framework and the wider Platform extension points (Architecture §25) exist precisely so that growth happens by adding registered modules, not by redesigning the core each time — but an empty, unbuilt agent slot in the Registry, a documented-but-unimplemented Plugin SDK, or a reserved-but-unpublished domain event is not the same as a shipped capability, and the two must never be conflated in what the product claims to a customer (Constitution §2, rule #1; Architecture §26).
