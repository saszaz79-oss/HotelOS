/**
 * Prompt Registry entry (Architecture §21, DECISIONS.md D19) — v0.1
 * file-based, version-controlled by git history.
 *
 * id: executive-summary
 * owner: HotelOS core team
 * version: 1
 * language: en (system instructions are language-neutral; the requested
 *   output language is passed as a variable, matching the Constitution's
 *   Arabic-first requirement without duplicating the prompt file per locale
 *   for this first, simple template)
 * modelCompatibility: claude-sonnet-5 and later Claude models
 * variables: hotelName, reportDate, language, metricsBlock, unavailableBlock
 * approvalStatus: draft (first version, not yet pilot-validated)
 * changeHistory: see git log for this file
 */

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
4. Clearly separate facts (directly from the data) from any interpretation or recommendation — label interpretation as such.
5. Write 3-5 concise sentences suitable for a hotel General Manager reading on a phone. No preamble, no "Here is a summary" — start directly with the content.
6. Respond in the requested language only.`;

export function buildExecutiveSummaryPrompt(input: ExecutiveSummaryPromptInput): string {
  return `Hotel: ${input.hotelName}
Report date: ${input.reportDate}
Respond in: ${input.language === 'ar' ? 'Arabic' : 'English'}

Verified metrics for this date:
${input.metricsBlock}

Unavailable metrics for this date (do not mention specific values for these — you may note they are unavailable):
${input.unavailableBlock || 'None — all core metrics available.'}

Write the executive summary now.`;
}
