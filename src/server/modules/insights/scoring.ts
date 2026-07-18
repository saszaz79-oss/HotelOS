export interface HealthFactor {
  factorKey: string;
  labelEn: string;
  weight: number;
  contribution: number;
  status: 'ok' | 'insufficient_data';
  note: string;
}

interface MetricPoint {
  key: string;
  value: number | null;
}

function metricValue(points: MetricPoint[], key: string): number | null {
  return points.find((p) => p.key === key)?.value ?? null;
}

/**
 * Health Score methodology (PRD §6, Constitution §1 truth test): every
 * contributing factor is computed here and returned alongside the score —
 * the score is never stored or shown without its factor breakdown
 * (Database Schema `Insight.healthScoreFactors`, DECISIONS.md D5).
 *
 * Trend-based factors compare against the most recent prior available date
 * when one exists; otherwise they fall back to an absolute reference and are
 * marked `insufficient_data` so the UI can say "no baseline yet" honestly
 * rather than implying a real comparison happened.
 */
export function computeHealthScore(
  today: MetricPoint[],
  previous: MetricPoint[] | null,
  completenessScore: number | null
): { healthScore: number; factors: HealthFactor[] } {
  const factors: HealthFactor[] = [];

  // Occupancy (weight 30)
  const occ = metricValue(today, 'occupancy_pct');
  const occPrev = previous ? metricValue(previous, 'occupancy_pct') : null;
  if (occ === null) {
    factors.push({ factorKey: 'occupancy', labelEn: 'Occupancy', weight: 30, contribution: 0, status: 'insufficient_data', note: 'Occupancy % not available for this date' });
  } else if (occPrev !== null) {
    const delta = occ - occPrev;
    const contribution = clamp(15 + delta * 0.5, 0, 30);
    factors.push({ factorKey: 'occupancy', labelEn: 'Occupancy', weight: 30, contribution, status: 'ok', note: `${occ}% vs ${occPrev}% previous available date` });
  } else {
    const contribution = clamp((occ / 100) * 30, 0, 30);
    factors.push({ factorKey: 'occupancy', labelEn: 'Occupancy', weight: 30, contribution, status: 'insufficient_data', note: `${occ}% — no prior date to compare against` });
  }

  // ADR trend (weight 20)
  const adr = metricValue(today, 'adr');
  const adrPrev = previous ? metricValue(previous, 'adr') : null;
  if (adr === null) {
    factors.push({ factorKey: 'adr_trend', labelEn: 'ADR Trend', weight: 20, contribution: 0, status: 'insufficient_data', note: 'ADR not available for this date' });
  } else if (adrPrev !== null && adrPrev > 0) {
    const pctDelta = (adr - adrPrev) / adrPrev;
    const contribution = clamp(10 + pctDelta * 40, 0, 20);
    factors.push({ factorKey: 'adr_trend', labelEn: 'ADR Trend', weight: 20, contribution, status: 'ok', note: `${adr} vs ${adrPrev} previous available date` });
  } else {
    factors.push({ factorKey: 'adr_trend', labelEn: 'ADR Trend', weight: 20, contribution: 10, status: 'insufficient_data', note: 'No prior ADR to compare against' });
  }

  // Open balance risk (weight 20) — higher open balance relative to revenue is worse.
  const openBalance = metricValue(today, 'open_balance');
  const totalRevenue = metricValue(today, 'total_revenue');
  if (openBalance === null) {
    factors.push({ factorKey: 'open_balance_risk', labelEn: 'Open Balance Risk', weight: 20, contribution: 10, status: 'insufficient_data', note: 'Open balance not available for this date' });
  } else if (totalRevenue !== null && totalRevenue > 0) {
    const ratio = openBalance / totalRevenue;
    const contribution = clamp(20 - ratio * 40, 0, 20);
    factors.push({ factorKey: 'open_balance_risk', labelEn: 'Open Balance Risk', weight: 20, contribution, status: 'ok', note: `Open balance is ${(ratio * 100).toFixed(0)}% of total revenue` });
  } else {
    const contribution = clamp(20 - openBalance / 1000, 0, 20);
    factors.push({ factorKey: 'open_balance_risk', labelEn: 'Open Balance Risk', weight: 20, contribution, status: 'insufficient_data', note: 'No total revenue to compare open balance against — using absolute reference' });
  }

  // Data completeness (weight 30)
  if (completenessScore === null) {
    factors.push({ factorKey: 'data_completeness', labelEn: 'Data Completeness', weight: 30, contribution: 0, status: 'insufficient_data', note: 'No source report completeness score available' });
  } else {
    factors.push({ factorKey: 'data_completeness', labelEn: 'Data Completeness', weight: 30, contribution: completenessScore * 30, status: 'ok', note: `Source report ${Math.round(completenessScore * 100)}% complete` });
  }

  const healthScore = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  return { healthScore, factors };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
