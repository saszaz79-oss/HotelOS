import type { RuleAlert } from './rules';

interface MetricPoint {
  key: string;
  value: number | null;
}

function metric(points: MetricPoint[], key: string): number | null {
  const p = points.find((p) => p.key === key);
  return p && p.value !== null ? p.value : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** 1% relative or 1 absolute unit, whichever is larger — matches this module's existing rounding precision (rules.ts's round() helper). */
function isConsistent(actual: number, expected: number): boolean {
  const tolerance = Math.max(1, Math.abs(expected) * 0.01);
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Mathematical cross-checks between metrics that should agree by
 * definition — flags a mismatch as a `consistency`-category Alert, never
 * silently corrects anything (Constitution truth test: flag a
 * discrepancy, don't fabricate a "fixed" value). Distinct from
 * insights/rules.ts's business-signal rules (occupancy thresholds,
 * no-show spikes, etc.) — this module only asks "do these numbers agree
 * with each other," not "is this number concerning."
 */
export function checkMetricConsistency(points: MetricPoint[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];

  const occupancy = metric(points, 'occupancy_pct');
  const adr = metric(points, 'adr');
  const revpar = metric(points, 'revpar');
  const roomRevenue = metric(points, 'room_revenue');
  const roomsSold = metric(points, 'rooms_sold');
  const cash = metric(points, 'cash');
  const card = metric(points, 'card');
  const cityLedger = metric(points, 'city_ledger');
  const totalRevenue = metric(points, 'total_revenue');
  const adults = metric(points, 'adults');
  const children = metric(points, 'children');
  const totalGuests = metric(points, 'total_guests');

  // RevPAR = ADR x Occupancy%
  if (revpar !== null && adr !== null && occupancy !== null) {
    const expected = adr * (occupancy / 100);
    if (!isConsistent(revpar, expected)) {
      alerts.push({
        severity: 'warning',
        category: 'consistency',
        messageEn: `RevPAR (${round(revpar, 2)}) doesn't match ADR x Occupancy (${round(expected, 2)}) — verify extracted values.`,
        messageAr: `الإيراد لكل غرفة متاحة (${round(revpar, 2)}) لا يطابق متوسط سعر الغرفة × نسبة الإشغال (${round(expected, 2)}) — تحقق من القيم المستخرجة.`,
        relatedMetricKey: 'revpar',
      });
    }
  }

  // ADR = Room Revenue / Rooms Sold — defense-in-depth only. Normalization
  // (metrics/commands.ts) already recomputes ADR from these same components
  // at finalize time and overwrites whatever was extracted, so a live
  // report finalized through the normal flow should never actually
  // disagree here; this exists to catch a normalization-path regression,
  // not to flag real-world extraction noise.
  if (adr !== null && roomRevenue !== null && roomsSold !== null && roomsSold > 0) {
    const expected = roomRevenue / roomsSold;
    if (!isConsistent(adr, expected)) {
      alerts.push({
        severity: 'info',
        category: 'consistency',
        messageEn: `ADR (${round(adr, 2)}) doesn't match Room Revenue / Rooms Sold (${round(expected, 2)}).`,
        messageAr: `متوسط سعر الغرفة (${round(adr, 2)}) لا يطابق إيرادات الغرف ÷ الغرف المباعة (${round(expected, 2)}).`,
        relatedMetricKey: 'adr',
      });
    }
  }

  // Payment components vs Total Revenue
  if (totalRevenue !== null && (cash !== null || card !== null || cityLedger !== null)) {
    const sum = (cash ?? 0) + (card ?? 0) + (cityLedger ?? 0);
    if (!isConsistent(sum, totalRevenue)) {
      alerts.push({
        severity: 'warning',
        category: 'consistency',
        messageEn: `Cash + Card + City Ledger (${round(sum, 2)}) doesn't match Total Revenue (${round(totalRevenue, 2)}).`,
        messageAr: `نقدي + بطاقة + دفتر المدينة (${round(sum, 2)}) لا يطابق إجمالي الإيرادات (${round(totalRevenue, 2)}).`,
        relatedMetricKey: 'total_revenue',
      });
    }
  }

  // Guest components vs Total Guests
  if (totalGuests !== null && (adults !== null || children !== null)) {
    const sum = (adults ?? 0) + (children ?? 0);
    if (!isConsistent(sum, totalGuests)) {
      alerts.push({
        severity: 'info',
        category: 'consistency',
        messageEn: `Adults + Children (${round(sum, 0)}) doesn't match Total Guests (${round(totalGuests, 0)}).`,
        messageAr: `البالغون + الأطفال (${round(sum, 0)}) لا يطابق إجمالي النزلاء (${round(totalGuests, 0)}).`,
        relatedMetricKey: 'total_guests',
      });
    }
  }

  return alerts;
}
