import { prisma } from '@/lib/prisma';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { getLatestMetricDate, getMetricsForDate } from '@/server/modules/metrics/queries';
import { EXECUTIVE_SUMMARY_SYSTEM_PROMPT, buildExecutiveSummaryPrompt } from './prompts/executive-summary';
import { ProviderUnavailableError } from './provider';

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
  knownHotelName?: string
): Promise<ExecutiveSummaryResult> {
  // Retrieval — verified metrics only, nothing inferred. getLatestMetricDate
  // and getMetricsForDate are both React cache()-wrapped, so when the
  // caller already fetched the same (hotelId, date) this request, these
  // resolve from the request-scoped cache rather than re-querying.
  const latestDate = await getLatestMetricDate(hotelId);
  if (!latestDate) {
    return { ok: false, reason: 'NO_DATA', message: 'No finalized metrics available yet for this hotel.' };
  }

  const hotelName =
    knownHotelName ?? (await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { name: true } })).name;
  const metrics = await getMetricsForDate(hotelId, latestDate);
  const availableKeys = new Set(metrics.map((m) => m.metricKey));

  const citedMetrics: CitedMetric[] = metrics
    .filter((m) => m.value !== null)
    .map((m) => ({
      metricKey: m.metricKey,
      labelEn: m.metricDefinition.labelEn,
      value: m.value as number,
      metricDate: m.metricDate.toISOString().slice(0, 10),
      sourceReportDocumentId: m.sourceReportDocumentId,
    }));

  const metricsBlock = citedMetrics.map((m) => `- ${m.labelEn}: ${m.value}`).join('\n');
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
