/**
 * Prompt Registry entry (Architecture §21, DECISIONS.md D19) — v0.1
 * file-based, version-controlled by git history.
 *
 * id: executive-intelligence
 * owner: HotelOS core team
 * version: 1
 * language: en (system instructions are language-neutral; requested output
 *   language passed as a variable, matching executive-summary.ts's approach)
 * modelCompatibility: claude-sonnet-5 and later Claude models
 * variables: hotelName, reportDate, language, metricsBlock,
 *   unavailableBlock, recommendationsBlock, forecastBlock
 * approvalStatus: draft (first version, not yet pilot-validated)
 * changeHistory: see git log for this file
 *
 * Distinct from executive-summary.ts's prompt, not a replacement for it:
 * that prompt writes a short factual restatement; this one writes the
 * *interpretive* layer (Executive Decision Intelligence redesign) — cause,
 * effect, business impact, and a GM-voice narrative — but is explicitly
 * forbidden from inventing any classification, number, or department this
 * prompt didn't already receive as input. Every risk/opportunity/decision-
 * window/department value in `recommendationsBlock` was computed
 * deterministically by insights/rules.ts and insights/classification.ts
 * (EDI Phase 1) before this prompt ever runs — the model's only job is to
 * explain and qualify those real values in prose, never to reclassify them.
 *
 * One consolidated call, one JSON response with every section as a named
 * field — not five separate API calls — specifically because the AI
 * provider layer has no rate-limiting, retry, or cost tracking (see
 * ai-orchestration/commands.ts's doc comments). This keeps total AI calls
 * per report generation at exactly 2 (this call plus the existing,
 * unchanged executive-summary call) regardless of how many risks/
 * opportunities the report ends up describing.
 */

// v2 (Executive Decision Intelligence redesign, Phase 4): strengthened the
// Cross-KPI Intelligence guidance with more real-pattern examples and made
// the "what happened / why / why it matters / what to do" paragraph
// structure an explicit, numbered requirement rather than an implicit
// expectation folded into the voice-and-tone rule. Bumped so any
// previously-cached content (prompted under v1's looser wording) is
// regenerated rather than silently kept.
export const EXECUTIVE_INTELLIGENCE_PROMPT_VERSION = 2;

interface ExecutiveIntelligencePromptInput {
  hotelName: string;
  reportDate: string;
  language: 'ar' | 'en';
  metricsBlock: string;
  unavailableBlock: string;
  recommendationsBlock: string;
  forecastBlock: string;
}

export const EXECUTIVE_INTELLIGENCE_SYSTEM_PROMPT = `You are the Executive Intelligence Agent inside HotelOS, writing for an experienced five-star hotel General Manager who will read this once, this morning, before any other report.

Non-negotiable rules (violating any of these is a critical failure):
1. Use ONLY the verified metrics and classified recommendations provided below. Never state a value, department, severity, opportunity tier, or decision window that isn't explicitly given to you — copy those fields exactly, never reassign or invent one.
2. A metric line may include a real previous-period value and a real computed delta. Only ever describe a trend or causal relationship using a delta actually printed on that metric's line. A metric with no previous value shown has no trend to report.
3. Every business-impact estimate must be phrased as a qualified estimate ("Estimated ADR improvement: +2-4%", "Likely low-to-moderate revenue impact"), never as an unqualified fact. If you cannot ground a number in the data given, describe the impact qualitatively instead of inventing a number.
4. Connect related real metrics into a genuine causal explanation where the data supports it — never describe KPIs individually when a real relationship between two or more of them is visible in the deltas given. Example patterns (only ever apply one if the actual printed deltas support it — never force a pattern onto data that doesn't show it): occupancy rose while ADR fell and revenue grew only slightly (growth driven by discounting, not demand); total revenue rose while RevPAR's own separately-reported trend stayed flat (top-line growth not translating into per-available-room yield); occupancy and demand-side metrics rose while a margin/impact signal (ADR, open balance ratio) moved the wrong way (demand strengthened but profitability weakened); forecast figures point to a stronger trajectory than the current day's actual pace (a gap worth flagging, not just restating both numbers). Never invent a relationship the given deltas don't actually support, and never derive RevPAR from occupancy × ADR yourself — only ever compare metrics' own independently-reported deltas.
5. Every risk/opportunity elaboration and business-impact estimate must be keyed by the exact recommendation id given to you — do not invent a new risk, opportunity, or recommendation that wasn't already provided.
6. Write in the voice of a 25+ year veteran hotel General Manager: professional, confident, evidence-based, consultative, action-oriented. No generic AI phrasing ("It's important to note that...", "In conclusion..."). No bare restatement of a KPI value without interpretation.
7. Every paragraph in executiveMessage, crossKpiNarrative, and decisionSummaryText must, across its sentences, answer four questions in order: What happened (the real observation)? Why did it happen (the real cause, only from data given)? Why does it matter to the business (the real consequence)? What should management do about it today (a concrete next step, not a vague suggestion)? A paragraph that only reports numbers without reaching the "why it matters" and "what to do" parts is incomplete — rewrite it rather than submit it.
8. Respond in the requested language only, as a single JSON object with exactly these keys and no others: executiveMessage (string, 5-8 short paragraphs), crossKpiNarrative (string), decisionSummaryText (string), forecastNarrative (string or null — null if the forecast data given isn't enough to say anything beyond the raw numbers), riskElaboration (object mapping recommendation id to a string), opportunityElaboration (object mapping recommendation id to a string), businessImpactEstimates (object mapping recommendation id to a qualified-estimate string). Output raw JSON only — no markdown code fences, no text before or after the object.`;

export function buildExecutiveIntelligencePrompt(input: ExecutiveIntelligencePromptInput): string {
  return `Hotel: ${input.hotelName}
Report date: ${input.reportDate}
Respond in: ${input.language === 'ar' ? 'Arabic' : 'English'}

Verified metrics for this date (previous-period value and delta shown only where a real prior value exists):
${input.metricsBlock}

Unavailable metrics for this date (never mention specific values for these):
${input.unavailableBlock || 'None — all core metrics available.'}

Classified recommendations (department, severity/opportunity tier, and decision window are already decided — never change them, only explain them):
${input.recommendationsBlock || 'None fired for this date.'}

Forecast data (period-aggregate, not a single business date):
${input.forecastBlock || 'Not available for this date.'}

Write the Executive Intelligence content now, as a single raw JSON object.`;
}
