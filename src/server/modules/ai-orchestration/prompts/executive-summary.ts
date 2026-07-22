/**
 * Prompt Registry entry (Architecture §21, DECISIONS.md D19) — v0.1
 * file-based, version-controlled by git history.
 *
 * id: executive-summary
 * owner: HotelOS core team
 * version: 2 (EDI Phase 3 — causal-chain rewrite, see below)
 * language: en (system instructions are language-neutral; the requested
 *   output language is passed as a variable, matching the Constitution's
 *   Arabic-first requirement without duplicating the prompt file per locale
 *   for this first, simple template)
 * modelCompatibility: claude-sonnet-5 and later Claude models
 * variables: hotelName, reportDate, language, metricsBlock, unavailableBlock
 * approvalStatus: draft (not yet pilot-validated)
 * changeHistory: see git log for this file
 *
 * v2 (EDI Phase 3): the original prompt only ever received a flat list of
 * current-period values, so it had no basis to write anything beyond a
 * restated KPI ("occupancy is 90.9%"). The Executive Intelligence Report
 * requires evidence-linked, causal-chain prose ("X increased, however Y
 * declined, indicating Z — review W within 72 hours"), which requires real
 * prior-period values to reason from. `metricsBlock` now carries each
 * metric's real previous value and real delta (computed by this codebase,
 * never by the model) alongside the current one, and the system prompt
 * requires every causal or comparative claim to cite that real delta —
 * never inventing a trend for a metric with no previous value on record.
 */

// Real, checkable version (was only a docblock comment above) — compared
// against AiExecutiveSummary.promptVersion to decide whether a cached
// summary is stale (Perf fix, Phase 1B). Bump whenever the prompt text
// changes in a way that should invalidate previously-cached summaries.
export const EXECUTIVE_SUMMARY_PROMPT_VERSION = 2;

interface ExecutiveSummaryPromptInput {
  hotelName: string;
  reportDate: string;
  language: 'ar' | 'en';
  metricsBlock: string;
  unavailableBlock: string;
}

export const EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `You are the Executive Agent inside HotelOS, a decision-support system for hotel general managers.

Non-negotiable rules (violating any of these is a critical failure):
1. Use ONLY the verified metrics provided below. Never state a value for any metric not explicitly listed.
2. If a metric is listed as unavailable, you may say it is unavailable — never estimate, infer, or guess a number for it.
3. Every factual statement must be directly traceable to a listed metric value.
4. A metric's line may include a real previous-period value and a real computed delta (e.g. "ADR: 202.23 (previous: 192.06, change: +10.17)"). Only ever describe a trend, comparison, or causal relationship ("X increased", "Y declined", "driven by") using a delta that is actually printed on that metric's line. If a metric has no previous value shown, describe it only as a standalone fact for this period — never imply a trend for it.
5. Where the data supports it, connect related metrics into a short causal chain rather than listing them separately — e.g. "ADR rose while occupancy held flat, indicating a successful rate increase" is a legitimate causal read of two real deltas; "revenue will likely keep growing" is not, since nothing in the data supports a forward projection.
6. When a pattern in the real data is significant enough to warrant action (a metric moved sharply against the hotel's interest, or two metrics disagree in a way that needs a decision), end with one concrete next step naming what to review and a realistic timeframe (e.g. "review housekeeping staffing within 72 hours"). Skip this when nothing in the data rises to that level — do not manufacture urgency.
7. Clearly separate facts (directly from the data, including real deltas) from any interpretation or recommendation — label interpretation as such rather than presenting it as a measured fact.
8. Write 3-5 concise sentences suitable for a hotel General Manager reading on a phone. No preamble, no "Here is a summary" — start directly with the content.
9. Respond in the requested language only.`;

export function buildExecutiveSummaryPrompt(input: ExecutiveSummaryPromptInput): string {
  return `Hotel: ${input.hotelName}
Report date: ${input.reportDate}
Respond in: ${input.language === 'ar' ? 'Arabic' : 'English'}

Verified metrics for this date (previous-period value and delta shown only where a real prior value exists — treat any metric without one as having no trend to report):
${input.metricsBlock}

Unavailable metrics for this date (do not mention specific values for these — you may note they are unavailable):
${input.unavailableBlock || 'None — all core metrics available.'}

Write the executive summary now.`;
}
