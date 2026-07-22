import { formatMetricValue } from '@/lib/format-metric';
import type { Locale } from '@/i18n/config';

export interface ResolvedEvidenceItem {
  label: string;
  value: string;
  metricDate: string;
  sourceReportDocumentId: string | null;
}

interface RawSupportingMetric {
  metricKey: string;
  value: number;
  metricDate: string;
  sourceReportDocumentId: string | null;
}

interface MetricDefinitionLookup {
  key: string;
  labelEn: string;
  labelAr: string;
  unit: string;
}

function isRawSupportingMetric(x: unknown): x is RawSupportingMetric {
  if (typeof x !== 'object' || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return typeof candidate.metricKey === 'string' && typeof candidate.value === 'number' && typeof candidate.metricDate === 'string';
}

/**
 * Turns a Recommendation.supportingMetrics JSON blob (written by
 * insights/rules.ts's `supporting()` helper) into real, labeled evidence
 * rows. The metricDate on each entry may not be a date already loaded
 * elsewhere on the page, so labels/units come from a full MetricDefinition
 * lookup rather than whatever metrics happen to already be in memory.
 * Never fabricates a label for an unresolvable key — flags it as
 * unresolved instead (Constitution truth test).
 */
export function resolveSupportingMetrics(
  supportingMetrics: unknown,
  definitions: MetricDefinitionLookup[],
  locale: Locale,
  unresolvedLabel: string,
  currency?: string
): ResolvedEvidenceItem[] {
  if (!Array.isArray(supportingMetrics)) return [];
  const defMap = new Map(definitions.map((d) => [d.key, d]));
  return supportingMetrics.filter(isRawSupportingMetric).map((m) => {
    const def = defMap.get(m.metricKey);
    return {
      label: def ? (locale === 'ar' ? def.labelAr : def.labelEn) : `${unresolvedLabel} (${m.metricKey})`,
      value: def ? formatMetricValue(m.value, def.unit, currency) : String(m.value),
      metricDate: m.metricDate.slice(0, 10),
      sourceReportDocumentId: m.sourceReportDocumentId,
    };
  });
}
