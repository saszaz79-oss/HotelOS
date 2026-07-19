/**
 * Display-layer rounding only — HotelMetric.value stays full-precision in
 * the database (e.g. computed ADR/RevPAR division results) so downstream
 * math never compounds a rounding error introduced here. Every UI surface
 * that renders a metric value should go through this instead of
 * interpolating the raw number (a raw computed ADR like
 * 307.575757575758 reaching the screen was found during the M5 hotel-
 * workspace audit).
 */
export function formatMetricValue(value: number, unit: string | undefined): string {
  switch (unit) {
    case 'percentage':
      return `${round(value, 1)}%`;
    case 'currency':
      return round(value, 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'count':
      return String(Math.round(value));
    default:
      return String(round(value, 2));
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
