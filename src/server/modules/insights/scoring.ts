import { invertRatioToScore } from './classification';

export interface HealthFactor {
  factorKey: string;
  labelEn: string;
  labelAr: string;
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
    factors.push({ factorKey: 'occupancy', labelEn: 'Occupancy', labelAr: 'نسبة الإشغال', weight: 30, contribution: 0, status: 'insufficient_data', note: 'Occupancy % not available for this date' });
  } else if (occPrev !== null) {
    const delta = occ - occPrev;
    const contribution = clamp(15 + delta * 0.5, 0, 30);
    factors.push({ factorKey: 'occupancy', labelEn: 'Occupancy', labelAr: 'نسبة الإشغال', weight: 30, contribution, status: 'ok', note: `${occ}% vs ${occPrev}% previous available date` });
  } else {
    const contribution = clamp((occ / 100) * 30, 0, 30);
    factors.push({ factorKey: 'occupancy', labelEn: 'Occupancy', labelAr: 'نسبة الإشغال', weight: 30, contribution, status: 'insufficient_data', note: `${occ}% — no prior date to compare against` });
  }

  // ADR trend (weight 20)
  const adr = metricValue(today, 'adr');
  const adrPrev = previous ? metricValue(previous, 'adr') : null;
  if (adr === null) {
    factors.push({ factorKey: 'adr_trend', labelEn: 'ADR Trend', labelAr: 'اتجاه متوسط سعر الغرفة', weight: 20, contribution: 0, status: 'insufficient_data', note: 'ADR not available for this date' });
  } else if (adrPrev !== null && adrPrev > 0) {
    const pctDelta = (adr - adrPrev) / adrPrev;
    const contribution = clamp(10 + pctDelta * 40, 0, 20);
    factors.push({ factorKey: 'adr_trend', labelEn: 'ADR Trend', labelAr: 'اتجاه متوسط سعر الغرفة', weight: 20, contribution, status: 'ok', note: `${adr} vs ${adrPrev} previous available date` });
  } else {
    factors.push({ factorKey: 'adr_trend', labelEn: 'ADR Trend', labelAr: 'اتجاه متوسط سعر الغرفة', weight: 20, contribution: 10, status: 'insufficient_data', note: 'No prior ADR to compare against' });
  }

  // Open balance risk (weight 20) — higher open balance relative to revenue is worse.
  const openBalance = metricValue(today, 'open_balance');
  const totalRevenue = metricValue(today, 'total_revenue');
  if (openBalance === null) {
    factors.push({ factorKey: 'open_balance_risk', labelEn: 'Open Balance Risk', labelAr: 'مخاطر الرصيد المفتوح', weight: 20, contribution: 10, status: 'insufficient_data', note: 'Open balance not available for this date' });
  } else if (totalRevenue !== null && totalRevenue > 0) {
    const ratio = openBalance / totalRevenue;
    const contribution = clamp(20 - ratio * 40, 0, 20);
    factors.push({ factorKey: 'open_balance_risk', labelEn: 'Open Balance Risk', labelAr: 'مخاطر الرصيد المفتوح', weight: 20, contribution, status: 'ok', note: `Open balance is ${(ratio * 100).toFixed(0)}% of total revenue` });
  } else {
    const contribution = clamp(20 - openBalance / 1000, 0, 20);
    factors.push({ factorKey: 'open_balance_risk', labelEn: 'Open Balance Risk', labelAr: 'مخاطر الرصيد المفتوح', weight: 20, contribution, status: 'insufficient_data', note: 'No total revenue to compare open balance against — using absolute reference' });
  }

  // Data completeness (weight 30)
  if (completenessScore === null) {
    factors.push({ factorKey: 'data_completeness', labelEn: 'Data Completeness', labelAr: 'اكتمال البيانات', weight: 30, contribution: 0, status: 'insufficient_data', note: 'No source report completeness score available' });
  } else {
    factors.push({ factorKey: 'data_completeness', labelEn: 'Data Completeness', labelAr: 'اكتمال البيانات', weight: 30, contribution: completenessScore * 30, status: 'ok', note: `Source report ${Math.round(completenessScore * 100)}% complete` });
  }

  const healthScore = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  return { healthScore, factors };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface ExecutiveScoreCategory {
  key: string;
  labelEn: string;
  labelAr: string;
  /** 0-100, or null when there's no honest way to compute a number at all (Guest Experience — no data source exists). */
  score: number | null;
  status: 'ok' | 'insufficient_data';
  note: string;
}

export interface ExecutiveScoreBreakdown {
  /** computeHealthScore's own existing output, unchanged — shown alongside these sub-scores, never recomputed as their average, so `Insight.healthScore`'s existing meaning stays stable. */
  overallBusinessHealth: number;
  financialHealth: ExecutiveScoreCategory;
  operationalHealth: ExecutiveScoreCategory;
  revenueHealth: ExecutiveScoreCategory;
  guestExperienceHealth: ExecutiveScoreCategory;
  dataQuality: ExecutiveScoreCategory;
}

/**
 * Executive Morning Brief's 6-way score breakdown (Executive Decision
 * Intelligence redesign) — decomposes the same real weighted-factor
 * approach `computeHealthScore` already uses into category sub-scores a GM
 * can scan independently, rather than one opaque number. Every sub-score
 * reuses factor math that's already real and computed elsewhere in this
 * file or in insights/rules.ts's ratio checks — nothing here is a new
 * formula invented for this function. Guest Experience Health always
 * returns `score: null` / `insufficient_data`: no guest-satisfaction data
 * source exists anywhere in HotelOS today, so it is never computed, never
 * guessed, and rendered distinctly in the UI (not a 0/100 tile).
 */
export function computeExecutiveScoreBreakdown(
  overallBusinessHealth: number,
  today: MetricPoint[],
  previous: MetricPoint[] | null,
  completenessScore: number | null
): ExecutiveScoreBreakdown {
  const val = (key: string) => metricValue(today, key);
  const prevVal = (key: string) => (previous ? metricValue(previous, key) : null);

  // Financial Health = open-balance risk (0-50) + revenue trend (0-50).
  const openBalance = val('open_balance');
  const totalRevenue = val('total_revenue');
  let financialScore = 0;
  let financialStatus: 'ok' | 'insufficient_data' = 'insufficient_data';
  const financialNotes: string[] = [];
  if (openBalance !== null && totalRevenue !== null && totalRevenue > 0) {
    const ratio = openBalance / totalRevenue;
    financialScore += clamp(50 - ratio * 100, 0, 50);
    financialNotes.push(`Open balance ${(ratio * 100).toFixed(0)}% of total revenue`);
    financialStatus = 'ok';
  } else {
    financialScore += 25;
    financialNotes.push('Open balance/revenue ratio not available');
  }
  const revPrev = prevVal('total_revenue');
  if (totalRevenue !== null && revPrev !== null && revPrev > 0) {
    const pctDelta = (totalRevenue - revPrev) / revPrev;
    financialScore += clamp(25 + pctDelta * 100, 0, 50);
    financialNotes.push(`Revenue ${pctDelta >= 0 ? '+' : ''}${(pctDelta * 100).toFixed(1)}% vs previous available date`);
    financialStatus = 'ok';
  } else {
    financialScore += 25;
    financialNotes.push('No prior revenue to compare against');
  }

  // Operational Health = OOO/OOI inverted ratio (0-50) + no-show/cancellation inverted rate (0-50).
  const roomsAvailable = val('rooms_available');
  const ooo = val('out_of_order_rooms');
  const ooi = val('out_of_inventory_rooms');
  let operationalScore = 0;
  let operationalStatus: 'ok' | 'insufficient_data' = 'insufficient_data';
  const operationalNotes: string[] = [];
  if (roomsAvailable !== null && roomsAvailable > 0 && (ooo !== null || ooi !== null)) {
    const downRatio = ((ooo ?? 0) + (ooi ?? 0)) / roomsAvailable;
    operationalScore += invertRatioToScore(downRatio / 0.1, 50);
    operationalNotes.push(`${(downRatio * 100).toFixed(1)}% of inventory out of order/service`);
    operationalStatus = 'ok';
  } else {
    operationalScore += 25;
    operationalNotes.push('Out-of-order/service ratio not available');
  }
  const arrivals = val('arrivals');
  const noShows = val('no_shows');
  const cancellations = val('cancellations');
  if (arrivals !== null && arrivals > 0 && (noShows !== null || cancellations !== null)) {
    const badRatio = ((noShows ?? 0) + (cancellations ?? 0)) / arrivals;
    operationalScore += invertRatioToScore(badRatio / 0.25, 50);
    operationalNotes.push(`${(badRatio * 100).toFixed(1)}% of arrivals no-showed or cancelled`);
    operationalStatus = 'ok';
  } else {
    operationalScore += 25;
    operationalNotes.push('No-show/cancellation rate not available');
  }

  // Revenue Health = occupancy (0-50) + ADR trend (0-50), same shape as computeHealthScore's own factors, rescaled.
  const occ = val('occupancy_pct');
  const occPrev = prevVal('occupancy_pct');
  let revenueScore = 0;
  let revenueStatus: 'ok' | 'insufficient_data' = 'insufficient_data';
  const revenueNotes: string[] = [];
  if (occ !== null && occPrev !== null) {
    revenueScore += clamp(25 + (occ - occPrev) * 0.83, 0, 50);
    revenueNotes.push(`Occupancy ${occ}% vs ${occPrev}% previous available date`);
    revenueStatus = 'ok';
  } else if (occ !== null) {
    revenueScore += clamp((occ / 100) * 50, 0, 50);
    revenueNotes.push(`Occupancy ${occ}% — no prior date to compare against`);
  } else {
    revenueScore += 25;
    revenueNotes.push('Occupancy not available');
  }
  const adr = val('adr');
  const adrPrev = prevVal('adr');
  if (adr !== null && adrPrev !== null && adrPrev > 0) {
    const pctDelta = (adr - adrPrev) / adrPrev;
    revenueScore += clamp(25 + pctDelta * 100, 0, 50);
    revenueNotes.push(`ADR ${pctDelta >= 0 ? '+' : ''}${(pctDelta * 100).toFixed(1)}% vs previous available date`);
    revenueStatus = 'ok';
  } else {
    revenueScore += 25;
    revenueNotes.push('No prior ADR to compare against');
  }

  return {
    overallBusinessHealth,
    financialHealth: {
      key: 'financial',
      labelEn: 'Financial Health',
      labelAr: 'الصحة المالية',
      score: Math.round(financialScore),
      status: financialStatus,
      note: financialNotes.join('; '),
    },
    operationalHealth: {
      key: 'operational',
      labelEn: 'Operational Health',
      labelAr: 'الصحة التشغيلية',
      score: Math.round(operationalScore),
      status: operationalStatus,
      note: operationalNotes.join('; '),
    },
    revenueHealth: {
      key: 'revenue',
      labelEn: 'Revenue Health',
      labelAr: 'صحة الإيرادات',
      score: Math.round(revenueScore),
      status: revenueStatus,
      note: revenueNotes.join('; '),
    },
    guestExperienceHealth: {
      key: 'guest_experience',
      labelEn: 'Guest Experience Health',
      labelAr: 'صحة تجربة النزيل',
      score: null,
      status: 'insufficient_data',
      note: 'No guest-satisfaction data source exists in HotelOS today.',
    },
    dataQuality: {
      key: 'data_quality',
      labelEn: 'Data Quality',
      labelAr: 'جودة البيانات',
      score: completenessScore !== null ? Math.round(completenessScore * 100) : null,
      status: completenessScore !== null ? 'ok' : 'insufficient_data',
      note: completenessScore !== null ? `Source report ${Math.round(completenessScore * 100)}% complete` : 'No source report completeness score available',
    },
  };
}
