# HotelOS Product Blueprint

## Positioning: Mission Control, Not a Dashboard

HotelOS is not a SaaS admin panel with charts bolted on. It is framed and built as an **operating system for hotel operations** — a persistent, always-on command environment a GM or owner lives inside, the way a pilot lives inside a cockpit or an operator lives inside a mission control room. Consequences of this framing (binding on every later design/architecture decision, not just marketing copy):

- The primary surface is not "a dashboard you check" but **Mission Control** — a live operational state, not a static report.
- Functionality is organized as **independent Agents** (see below), each a self-contained operational domain, the way an OS organizes capability as distinct applications/services rather than one monolithic screen.
- The product accumulates a **Hotel Timeline** and **Hotel Genome** — operating systems have persistent state and history; a dashboard resets to "now" every time you open it, HotelOS does not.
- Visual and interaction language draws from Apple, Linear, Stripe, and Tesla's mission-control aesthetic: calm, architectural, information-dense only where it earns density, never a generic ERP grid (see `UX_SYSTEM.md`, to be refreshed against this direction in Phase 1).

## Platform Vision: Built to Grow for Ten Years

HotelOS is not only an operating system for one hotel's operations — it is a **platform** that third-party developers and internal teams can extend without touching the core. This is a deliberate ten-year architectural commitment, not a v0.1 feature: the core (identity, tenancy, metrics, timeline, genome, audit) stays stable while capability grows through three extension mechanisms, each with a technical home in `ARCHITECTURE.md`:

- **Plugins** (`ARCHITECTURE.md` §18) — independent packages (manifest, permissions, lifecycle hooks, UI extensions, event subscriptions) that extend the platform without modifying core code.
- **Agents as installable modules** (`ARCHITECTURE.md` §13, §19) — every Agent, including future third-party ones, is versioned, permissioned, configurable, and health-monitored like an app in a marketplace, not a hardcoded feature.
- **A Domain Event Bus** (`ARCHITECTURE.md` §17) — platform activity (`ReportUploaded`, `MetricsExtracted`, `AlertCreated`, and reserved future events like `RoomCheckedIn`, `GuestArrived`, `RevenueUpdated`) is available for any current or future module to react to without tight coupling to the module that produced it.

**This is architectural discipline applied now, not a promise of marketplace features today.** `ARCHITECTURE.md` §26 states plainly which of these are real, working mechanisms in v0.1 (the Event Bus, internally) and which are documented interfaces with no runtime yet (the Plugin SDK loader, the Agent Marketplace UI, any third-party execution) — see Non-Goals below and `DECISIONS.md` D16–D22 for the reasoning.

## HotelOS Is a Decision Engine

HotelOS is not only an AI assistant with a nice dashboard around it. Internally, it is structured as a **Decision Engine** — a traceable pipeline from raw data to acted-on decisions: **Data → Metrics → Insights → Recommendations → Priorities → Decisions → Actions** (`ARCHITECTURE.md` §31). Every recommendation the product surfaces is traceable backward through that chain to the original uploaded report — this is what "show your work" (Constitution §1) means structurally, not just as a UI promise. The **Product Principle** governs everything added to this pipeline: *does this help hotel management make better decisions?* If not, it doesn't ship (Constitution, Product Principle).

## Vision

HotelOS becomes the digital brain of a hotel: the single operating environment a GM opens each morning to know exactly how the property is doing and what needs attention today, and returns to throughout the day the way one returns to an OS, not a report. Long-term, it sits above every hotel system (PMS, OTAs, spreadsheets, emails) and turns their combined exhaust into decisions, delivered through a growing family of specialized Agents — increasingly including third-party ones — running on a platform built to support that growth without a core rewrite.

## Problem

Independent hotels and small/mid hotel groups in Saudi Arabia and the GCC run on Opera Cloud (or similar PMS) plus a patchwork of exported PDF/Excel reports, WhatsApp updates, and manual spreadsheets. Consequences:

- GMs and owners spend time re-reading and re-typing PDF reports into spreadsheets to compare periods.
- No single, trustworthy view of "how are we doing today vs. yesterday / vs. last month."
- Decisions (rate changes, staffing, escalations) are made late because the data takes hours to assemble and interpret.
- Multi-property groups cannot see cross-property patterns without a manual roll-up exercise.
- Existing BI tools are generic, English-only, not built for Opera Cloud's report formats, and too complex for a GM to self-serve.

## Target Users

- **Primary market**: independent hotels and small hotel groups (3–30 properties) in Saudi Arabia and the GCC using Opera Cloud (or PMS with similar exports).
- **Primary buyer**: hotel owner or group General Manager / Managing Director.
- **Primary daily user**: General Manager, Revenue Manager, Front Office Manager at property level; Group Ops/Asset Manager at group level.

## Personas

**Rania — General Manager, single property, Riyadh.** Reviews Manager Flash and Reservation Statistics every morning. Needs a 2-minute answer to "is today good or bad, and why," in Arabic, on her phone before the morning briefing.

**Faisal — Revenue Manager, 4-property group, Jeddah.** Compares ADR/RevPAR trends across properties weekly, builds a report for ownership monthly. Wants fast comparisons and an exportable, professional PDF he doesn't have to build in Excel.

**Nora — Group Asset Manager, owns/oversees a portfolio, remote.** Checks in a few times a week, cares about exceptions and risk — not daily operational detail. Needs alerts and a health score, not raw tables.

**Yousef — Front Office Manager.** Cares about today's arrivals/departures/out-of-order rooms and open balance. Operational, not strategic; needs a fast mobile view during a shift.

## Jobs to Be Done

- "When I start my day, help me know instantly if anything needs my attention."
- "When ownership asks how we did this month, let me generate a professional report in minutes, not hours."
- "When a number looks off, let me ask why instead of digging through PDFs."
- "When I compare periods or properties, do the math and the interpretation for me, correctly, every time."

## Value Proposition

HotelOS turns a stack of Opera Cloud PDF exports into an executive-grade daily briefing, transparent health score, natural-language Q&A, and boardroom-ready export — in Arabic and English, in minutes, without asking anyone to change how they already export data from Opera. It is delivered as an operating system with one Agent live at launch and a framework built to add more without redesign.

## Agent Architecture (Product Concept)

HotelOS capability is organized as a family of **Agents** — independent operational modules, each owning a domain, with its own frontend surface, backend module, permission scope, and AI orchestration, all running inside the shared HotelOS Mission Control shell (see `ARCHITECTURE.md` for the technical framework).

- **Executive Agent** — cross-functional health, comparisons, executive Q&A and reporting. **Ships in v0.1.**
- **Revenue Agent** — ADR/RevPAR trend intelligence, rate/segment analysis. Framework-ready in v0.1, full agent in v0.2+.
- **Front Office Agent** — arrivals/departures/stayovers, today's operational load. Framework-ready in v0.1, full agent in v0.2+.
- **Housekeeping Agent** — room status/turnover operations. Future (v0.3+).
- **Finance Agent** — open balance, ledger, cash/card reconciliation intelligence. Future (v0.2+).
- **Maintenance Agent** — out-of-order/out-of-inventory root-cause and trend tracking. Future (v0.3+).
- **Sales Agent** — group/contract and segment performance. Future (v0.3+).

Only the Executive Agent is a complete, user-facing agent in v0.1. Critically, the **Agent Framework itself — the interface, permission model, timeline/genome integration, and AI orchestration pattern every agent must implement — is v0.1 architecture, not a v0.2 add-on.** This is what lets later agents be added as new modules rather than product rewrites (see Roadmap and Architecture §Agent Framework), and it is the same pattern a future Marketplace agent (Architecture §19) will use.

## Hotel Timeline

Rather than a "recent uploads" list, HotelOS maintains a chronological, per-hotel **operational timeline**: uploads, extracted-metric changes, alerts raised, AI recommendations issued, comparisons run, executive decisions logged, and exports generated all appear as timeline events. This is a core product experience from v0.1, not a future enhancement — it is how a user "scrolls back through" the hotel's operational history, the way one would review a system log or a mission timeline, and it is the substrate the Hotel Genome concept below is built on. It also doubles as the human-readable face of the platform's Domain Event Bus (Architecture §17) — most timeline events correspond directly to a domain event other modules can react to.

## Hotel Genome

Every report, extracted metric, recommendation, executive decision, and AI conversation contributes to a durable, per-hotel **Hotel Genome** — the hotel's learned operational identity, superseding the earlier "Hotel Memory" framing with a broader ambition (see `DECISIONS.md` D18). Where "memory" implied a record of what happened, "genome" is meant literally: the platform learns what makes *this* hotel behave the way it does — seasonal behavior, guest patterns, revenue behavior, occupancy behavior, recurring operational strengths and weaknesses, recurring issues, employee performance trends, historical executive decisions, and the outcomes of past AI recommendations (accepted, ignored, or reversed) — and future agents personalize their reasoning against that genome instead of treating every hotel identically.

This is what allows HotelOS to eventually say "occupancy dipped this way twice before, both times before a public holiday, and last time the GM's response was X" instead of only ever reasoning about today's upload. The genome is built and populated from v0.1 (every finalized report, recommendation, and AI conversation feeds it, including a lightweight outcome tag on each recommendation); deep pattern-recognition (seasonal modeling, employee-performance trend detection) deepens through v0.2/v0.3 as real history accumulates — a genome is only as good as the history it has, and modeling patterns from two weeks of pilot data would be fabrication, not insight (Constitution §4), so the sophisticated behavioral modeling is deliberately sequenced after enough real data exists, while the substrate that will feed it starts recording from day one.

## MVP Scope

See `MVP_PRD.md` for full detail. **The v0.1 build is intentionally narrower than the full platform vision above**: one complete, production-quality workflow — Opera PDF upload → validation (including real Data Quality scoring, Architecture §33) → metric extraction → normalization → Mission Control → Executive AI analysis → professional PDF export → archive — plus the underlying platform seams (Agent Framework, Event Bus, Hotel Timeline, foundation of Hotel Genome, Feature Flags, centralized tenant scoping, audit/observability conventions) that make the *next* workflow and the *next* agent additive rather than a rewrite. Plugin SDK runtime, Agent Marketplace UI, Workflow Automation Engine, Action Center, and Digital Twin are explicitly architecture-only or documentation-only in v0.1 (Architecture §26) — quality on the one core workflow comes before breadth (see Roadmap).

## Non-Goals (for v0.1)

- Live/real-time PMS API integration (Opera Cloud API, etc.) — v0.1 is document-upload based.
- Direct write-back to Opera Cloud or any PMS (HotelOS is read/analyze only in MVP).
- Fully-realized Revenue, Front Office, Housekeeping, Finance, Maintenance, and Sales Agents — only the Executive Agent ships complete; the framework for the rest ships, the agents themselves do not (see Agent Architecture above).
- Revenue management/rate-shopping automation.
- Guest-facing features (booking, CRM, messaging).
- Native mobile apps (PWA only in MVP; app-store packaging is future work).
- Support for every possible Opera report layout — only the listed report categories, with documented fallback behavior for the rest.
- Multi-language beyond Arabic/English.
- Deep semantic/pattern-recognition retrieval over the Hotel Genome (v0.1 genome is built and stored in structured form; sophisticated cross-period/behavioral pattern retrieval deepens in v0.2/v0.3 as history accumulates).
- Plugin SDK runtime (loader, sandboxing, installation UI), Agent Marketplace UI (browse/install/enable/disable), and any third-party plugin or agent execution — the manifests and permission model are designed (Architecture §18–§19) but nothing external runs in v0.1.
- Workflow Automation Engine of any kind — no trigger/action UI, no execution runtime, no automation persistence (Architecture §20). The domain events it would eventually consume are real; the engine itself is explicitly out of scope for this build.
- Database-backed Prompt Registry with an approval-workflow UI (v0.1 uses a file-based, version-controlled registry — see Architecture §21) and the Knowledge Registry's actual content/UI (schema documented, unpopulated — Architecture §22).

## Future Modules (beyond MVP)

- Revenue Agent, Front Office Agent, Finance Agent, Maintenance Agent, Housekeeping Agent, Sales Agent — full implementations on top of the v0.1 Agent Framework (see Roadmap for sequencing).
- Plugin SDK runtime and Plugin Marketplace UI, opening the platform to third-party developers (Architecture §18).
- Agent Marketplace UI and third-party Agents, once the internal agent family has proven the framework (Architecture §19).
- Workflow Automation Engine — a visual, Zapier/n8n-style builder over the Domain Event Bus (Architecture §17, §20).
- Action Center — turning Recommendations into assigned, due-dated, verifiable tasks (Architecture §32).
- Hotel Digital Twin — scenario simulation for occupancy, staffing, and revenue, consuming the Hotel Genome (Architecture §34). Reserved conceptually only; no design work beyond that until real demand justifies it.
- Direct PMS/OTA API integrations (Opera Cloud, Cloudbeds, etc.)
- Forecasting and demand prediction
- Automated rate recommendations
- Group/portfolio roll-up Mission Control at scale (multi-property command view)
- Staff task/workflow assignment from alerts
- Guest sentiment/review analysis integration
- Subscription billing and self-serve onboarding

## Risks and Assumptions

- **Assumption**: hotels can reliably export the listed Opera report types as PDF. Risk: layout variance across Opera Cloud versions/regions breaks deterministic extraction — mitigated by a documented adapter architecture and manual-review step, not a promise of universal parsing.
- **Assumption**: GMs will trust a health score if its methodology is transparent. Risk: opacity kills trust — mitigated by always showing contributing factors.
- **Risk**: AI hallucination in a financial/operational context is reputationally dangerous — mitigated by strict grounding rules (see Constitution §4) and by never letting the AI compute new operational facts, only reason over stored, verified data.
- **Risk**: multi-tenant data leakage is catastrophic for a hospitality SaaS selling to competitors of each other — mitigated by the data-access-layer enforcement described in the Constitution and Architecture docs.
- **Assumption**: Arabic-first RTL demands are non-negotiable for GCC adoption — treated as a v0.1 requirement, not a localization add-on.

## Success Metrics (early stage)

- Time from PDF upload to reviewed, finalized metrics (target: under 5 minutes with manual review).
- % of uploaded reports successfully auto-extracted without manual correction (tracked per report type, expected to improve over time — not assumed to start high).
- Daily active usage of Mission Control per hotel (a proxy for "did this become part of the morning routine").
- Number of AI questions asked per hotel per week (engagement with the decision-support layer, not just the dashboard).
- Executive PDF exports generated per month (proxy for "did this replace a manual reporting task").
- Timeline scroll-back engagement (proxy for whether the operational history is actually being used, not just today's snapshot).
- Growth in Hotel Genome depth per hotel over time (reports/conversations/decisions/recommendation-outcomes accumulated) as a leading indicator of future-agent readiness.

## Business Model Direction

Per-hotel SaaS subscription (tiered by number of properties / report volume / AI usage), sold to independent hotels and small groups directly, with hotel-group / Super-Admin tooling designed in from the start to support multi-property accounts as the natural upsell path. Pricing and packaging are out of scope for Phase 0 but the `licenses/subscriptions` domain module and hotel `license start/expiry` fields are reserved in the schema from v0.1 so billing can be layered on without a data-model rewrite.
