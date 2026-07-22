import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { getLatestMetricDate, getMetricsForDate, getPreviousMetricDate } from '@/server/modules/metrics/queries';
import { EXECUTIVE_SUMMARY_SYSTEM_PROMPT, EXECUTIVE_SUMMARY_PROMPT_VERSION, buildExecutiveSummaryPrompt } from './prompts/executive-summary';
import { ProviderUnavailableError } from './provider';
import { getCachedExecutiveSummary } from './queries';

// Real, checkable version for the generation/validation *logic* in this
// file, independent of the prompt text's own version (Perf fix, Phase 1B).
// Bump whenever this function's retrieval/validation behavior changes in a
// way that should invalidate previously-cached summaries.
// v2 (EDI Phase 3): retrieval now also fetches/derives real previous-period
// values per metric, feeding the causal-chain prompt rewrite below.
export const EXECUTIVE_SUMMARY_ANALYSIS_VERSION = 2;

const CORE_METRIC_KEYS = [
  'occupancy_pct',
  'adr',
  'revpar',
  'room_revenue',
  'total_revenue',
  'rooms_sold',
  'rooms_available',
  'arrivals',
  'departures',
  'open_balance',
];

export interface CitedMetric {
  metricKey: string;
  labelEn: string;
  value: number;
  metricDate: string;
  sourceReportDocumentId: string | null;
}

export type ExecutiveSummaryResult =
  | { ok: true; summary: string; citedMetrics: CitedMetric[]; model: string; language: 'ar' | 'en' }
  | { ok: false; reason: 'NO_DATA' | 'NOT_CONFIGURED' | 'PROVIDER_ERROR'; message: string };

/**
 * AI Orchestration pipeline for the Executive Summary (Architecture §30):
 * retrieval → prompt selection → reasoning → validation → citations →
 * formatting. Only ever reads through `metrics` module queries — never
 * touches Prisma models outside its own context directly for anything but
 * its own timeline publish (Architecture §4/§27 module-interface discipline).
 */
export async function generateExecutiveSummary(
  hotelId: string,
  language: 'ar' | 'en',
  // Both current callers (mission-control, executive export) already have
  // this from their own membership lookup — skip the redundant by-id
  // fetch when it's handed in rather than re-querying for a value the
  // caller already holds (Perf sprint, M14).
  knownHotelName?: string,
  // Same idea, one level further (Perf sprint round 2): Mission Control
  // switched from a standalone getMetricsForDate(latestDate) call to a
  // batched getMetricsForDates([latest, previous]) call to save a round
  // trip — which means getMetricsForDate(hotelId, latestDate) below would
  // no longer be cache()-deduped against anything (it'd be the only caller
  // with that exact args tuple), silently reintroducing the round trip it
  // was meant to remove. Passing the already-resolved values in sidesteps
  // that entirely rather than depending on cache() dedup staying aligned
  // with every caller's fetch strategy.
  known?: {
    latestDate: Date;
    metrics: Awaited<ReturnType<typeof getMetricsForDate>>;
    // Real prior-period values (EDI Phase 3) — both existing callers
    // (Mission Control, Executive Export) already fetch this for their own
    // "vs previous" KPI display, so passing it through avoids a second
    // round trip for the same data (same Perf-sprint pattern as `metrics`
    // above). Optional: a caller with no previous-period concept (or one
    // not yet updated) simply gets no trend data in the prompt, never a
    // fabricated one.
    previousMetrics?: Awaited<ReturnType<typeof getMetricsForDate>>;
  }
): Promise<ExecutiveSummaryResult> {
  // Retrieval — verified metrics only, nothing inferred. getLatestMetricDate
  // and getMetricsForDate are both React cache()-wrapped, so when the
  // caller already fetched the same (hotelId, date) this request (and
  // didn't pass `known`), these resolve from the request-scoped cache
  // rather than re-querying.
  const latestDate = known?.latestDate ?? (await getLatestMetricDate(hotelId));
  if (!latestDate) {
    return { ok: false, reason: 'NO_DATA', message: 'No finalized metrics available yet for this hotel.' };
  }

  const hotelName =
    knownHotelName ?? (await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { name: true } })).name;
  const metrics = known?.metrics ?? (await getMetricsForDate(hotelId, latestDate));
  const availableKeys = new Set(metrics.map((m) => m.metricKey));

  let previousMetrics = known?.previousMetrics;
  if (previousMetrics === undefined) {
    const previousDate = await getPreviousMetricDate(hotelId, latestDate);
    previousMetrics = previousDate ? await getMetricsForDate(hotelId, previousDate) : [];
  }
  const previousByKey = new Map(previousMetrics.filter((m) => m.value !== null).map((m) => [m.metricKey, m.value as number]));

  const citedMetrics: CitedMetric[] = metrics
    .filter((m) => m.value !== null)
    .map((m) => ({
      metricKey: m.metricKey,
      labelEn: m.metricDefinition.labelEn,
      value: m.value as number,
      metricDate: m.metricDate.toISOString().slice(0, 10),
      sourceReportDocumentId: m.sourceReportDocumentId,
    }));

  // Every delta here is computed by this codebase from two real stored
  // values, never by the model — the prompt is instructed to only describe
  // a trend using a delta actually printed on that metric's own line.
  const metricsBlock = citedMetrics
    .map((m) => {
      const previous = previousByKey.get(m.metricKey);
      if (previous === undefined) return `- ${m.labelEn}: ${m.value}`;
      const delta = m.value - previous;
      const sign = delta >= 0 ? '+' : '';
      return `- ${m.labelEn}: ${m.value} (previous: ${previous}, change: ${sign}${Math.round(delta * 100) / 100})`;
    })
    .join('\n');
  const unavailableKeys = CORE_METRIC_KEYS.filter((k) => !availableKeys.has(k));
  const unavailableBlock = unavailableKeys.join(', ');

  // Prompt selection (file-based Prompt Registry, Architecture §21).
  const userPrompt = buildExecutiveSummaryPrompt({
    hotelName,
    reportDate: latestDate.toISOString().slice(0, 10),
    language,
    metricsBlock,
    unavailableBlock,
  });

  // Reasoning.
  const { aiProvider } = await import('./index');
  let completion;
  try {
    completion = await aiProvider.complete([
      { role: 'system', content: EXECUTIVE_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
  } catch (err) {
    if (err instanceof ProviderUnavailableError) {
      return { ok: false, reason: err.reason, message: err.message };
    }
    return { ok: false, reason: 'PROVIDER_ERROR', message: err instanceof Error ? err.message : String(err) };
  }

  // Validation (best-effort — full hallucination detection is not solvable
  // deterministically; this is a bounded heuristic, not a truthfulness
  // guarantee, and is documented as such per Architecture §30 step 5).
  const mentionsUnavailable = unavailableKeys.some((key) => {
    const label = metrics.find((m) => m.metricKey === key)?.metricDefinition.labelEn;
    return label && new RegExp(`${label}\\s*(is|:)\\s*\\d`, 'i').test(completion.text);
  });
  if (mentionsUnavailable) {
    return {
      ok: false,
      reason: 'PROVIDER_ERROR',
      message: 'Generated summary referenced an unavailable metric with a value — discarded rather than shown.',
    };
  }

  await publishTimelineEvent({
    hotelId,
    eventType: 'ai_summary_generated',
    payload: { metricDate: latestDate.toISOString(), model: completion.model },
    // Related report (Validation Phase §6) — the source document behind the
    // metrics the summary was grounded in.
    sourceRef: citedMetrics[0]?.sourceReportDocumentId ?? null,
  });

  return { ok: true, summary: completion.text, citedMetrics, model: completion.model, language };
}

type CachedSummary = NonNullable<Awaited<ReturnType<typeof getCachedExecutiveSummary>>>;

/**
 * Perf fix, Phase 1B: whether a cached AiExecutiveSummary row is safe to
 * serve as-is. Catches three distinct cases — no cached row at all; the
 * prompt/analysis/model versions have moved on since it was generated; or
 * the underlying HotelMetric data for this exact date has been touched
 * since (a manual correction via correctHotelMetric bumps `updatedAt` for
 * the same metricDate, which must invalidate the summary grounded in the
 * old value).
 */
async function isStale(hotelId: string, metricDate: Date, cached: CachedSummary | null): Promise<boolean> {
  if (!cached) return true;
  if (cached.promptVersion !== EXECUTIVE_SUMMARY_PROMPT_VERSION) return true;
  if (cached.analysisVersion !== EXECUTIVE_SUMMARY_ANALYSIS_VERSION) return true;

  const latest = await prisma.hotelMetric.aggregate({
    where: { hotelId, metricDate },
    _max: { updatedAt: true },
  });
  return !!latest._max.updatedAt && latest._max.updatedAt > cached.generatedAt;
}

/**
 * Read-through cache in front of generateExecutiveSummary (Perf fix, Phase
 * 1B) — this is what Mission Control and Executive Export now call instead
 * of generateExecutiveSummary directly, so a page render only ever makes a
 * live AI call on a genuine cache miss/staleness, not on every visit.
 * A generation failure is never cached (a transient provider error must not
 * mask a later successful generation for the rest of the day).
 */
export async function getOrRefreshExecutiveSummary(
  hotelId: string,
  language: 'ar' | 'en',
  knownHotelName?: string,
  known?: {
    latestDate: Date;
    metrics: Awaited<ReturnType<typeof getMetricsForDate>>;
    previousMetrics?: Awaited<ReturnType<typeof getMetricsForDate>>;
  },
  options?: { forceRegenerate?: boolean; regeneratedByUserId?: string }
): Promise<ExecutiveSummaryResult> {
  const latestDate = known?.latestDate ?? (await getLatestMetricDate(hotelId));
  if (!latestDate) {
    return { ok: false, reason: 'NO_DATA', message: 'No finalized metrics available yet for this hotel.' };
  }

  const cached = options?.forceRegenerate ? null : await getCachedExecutiveSummary(hotelId, latestDate, language);
  if (cached && !(await isStale(hotelId, latestDate, cached))) {
    return {
      ok: true,
      summary: cached.summaryText,
      citedMetrics: cached.citedMetrics as unknown as CitedMetric[],
      model: cached.model,
      language,
    };
  }

  const fresh = await generateExecutiveSummary(hotelId, language, knownHotelName, known);
  if (fresh.ok) {
    const data = {
      summaryText: fresh.summary,
      citedMetrics: fresh.citedMetrics as unknown as Prisma.InputJsonValue,
      model: fresh.model,
      promptVersion: EXECUTIVE_SUMMARY_PROMPT_VERSION,
      analysisVersion: EXECUTIVE_SUMMARY_ANALYSIS_VERSION,
      sourceReportDocumentId: fresh.citedMetrics[0]?.sourceReportDocumentId ?? null,
      generatedAt: new Date(),
      generatedByUserId: options?.regeneratedByUserId ?? null,
    };
    await prisma.aiExecutiveSummary.upsert({
      where: { hotelId_metricDate_language: { hotelId, metricDate: latestDate, language } },
      update: data,
      create: { hotelId, metricDate: latestDate, language, ...data },
    });
  }
  return fresh;
}
