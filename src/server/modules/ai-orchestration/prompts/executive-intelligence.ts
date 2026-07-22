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

export const EXECUTIVE_INTELLIGENCE_PROMPT_VERSION = 1;

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
4. Connect related real metrics into a genuine causal explanation where the data supports it (e.g. occupancy rose while ADR fell and revenue grew only slightly — that pattern, if present in the real deltas given, indicates growth driven by discounting rather than demand). Never state a causal relationship the given deltas don't actually support.
5. Every risk/opportunity elaboration and business-impact estimate must be keyed by the exact recommendation id given to you — do not invent a new risk, opportunity, or recommendation that wasn't already provided.
6. Write in the voice of a 25+ year veteran hotel General Manager: professional, confident, evidence-based, consultative, action-oriented. No generic AI phrasing ("It's important to note that...", "In conclusion..."). No bare restatement of a KPI value without interpretation.
7. Respond in the requested language only, as a single JSON object with exactly these keys and no others: executiveMessage (string, 5-8 short paragraphs), crossKpiNarrative (string), decisionSummaryText (string), forecastNarrative (string or null — null if the forecast data given isn't enough to say anything beyond the raw numbers), riskElaboration (object mapping recommendation id to a string), opportunityElaboration (object mapping recommendation id to a string), businessImpactEstimates (object mapping recommendation id to a qualified-estimate string). Output raw JSON only — no markdown code fences, no text before or after the object.`;

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
