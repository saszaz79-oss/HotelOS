/**
 * Split out of commands.ts (Executive Decision Intelligence redesign) so
 * this pure JSON-parsing logic can be unit-tested without pulling in
 * commands.ts's transitive dependency chain (@/lib/prisma, the timeline
 * module, etc., several of which use React's cache() and can only run
 * inside the React Server Components runtime, not a plain node:test
 * process). No prisma, no server module imports — deliberately dependency-
 * free.
 */
export interface ExecutiveIntelligenceContent {
  executiveMessage: string;
  crossKpiNarrative: string;
  decisionSummaryText: string;
  forecastNarrative: string | null;
  riskElaboration: Record<string, string>;
  opportunityElaboration: Record<string, string>;
  businessImpactEstimates: Record<string, string>;
}

/**
 * Parses and validates the model's structured JSON response — fails closed
 * (returns null) on anything that doesn't match the expected shape exactly,
 * rather than trusting a partial/malformed object. `validRecommendationIds`
 * filters riskElaboration/opportunityElaboration/businessImpactEstimates
 * down to keys that are real, already-persisted recommendation ids — a
 * hallucinated id the model invented is dropped, never surfaced.
 */
export function parseIntelligenceResponse(text: string, validRecommendationIds: Set<string>): ExecutiveIntelligenceContent | null {
  let raw: unknown;
  try {
    // Models occasionally wrap JSON in a markdown fence despite instructions
    // not to — stripping it is a tolerance for that, not an acceptance of
    // malformed content; the parse below still fails closed on anything
    // that isn't valid JSON either way.
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    raw = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const strings = ['executiveMessage', 'crossKpiNarrative', 'decisionSummaryText'] as const;
  for (const key of strings) {
    if (typeof obj[key] !== 'string' || (obj[key] as string).trim().length === 0) return null;
  }
  if (obj.forecastNarrative !== null && typeof obj.forecastNarrative !== 'string') return null;

  const maps = ['riskElaboration', 'opportunityElaboration', 'businessImpactEstimates'] as const;
  const parsedMaps: Record<(typeof maps)[number], Record<string, string>> = {
    riskElaboration: {},
    opportunityElaboration: {},
    businessImpactEstimates: {},
  };
  for (const key of maps) {
    const value = obj[key];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    for (const [id, text] of Object.entries(value as Record<string, unknown>)) {
      if (typeof text !== 'string' || !validRecommendationIds.has(id)) continue;
      parsedMaps[key][id] = text;
    }
  }

  return {
    executiveMessage: obj.executiveMessage as string,
    crossKpiNarrative: obj.crossKpiNarrative as string,
    decisionSummaryText: obj.decisionSummaryText as string,
    forecastNarrative: (obj.forecastNarrative as string | null) ?? null,
    ...parsedMaps,
  };
}
