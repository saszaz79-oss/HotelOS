/**
 * Display-layer rounding only — HotelMetric.value stays full-precision in
 * the database (e.g. computed ADR/RevPAR division results) so downstream
 * math never compounds a rounding error introduced here. Every UI surface
 * that renders a metric value should go through this instead of
 * interpolating the raw number (a raw computed ADR like
 * 307.575757575758 reaching the screen was found during the M5 hotel-
 * workspace audit).
 */
/**
 * `currency` is optional and backward-compatible: existing call sites that
 * haven't been updated to pass `Hotel.currency` through keep their old
 * plain-number-no-symbol behavior exactly as before. Callers that do have a
 * hotel in scope should pass it — Business Impact Statements and Executive
 * Decision Boxes (Executive Decision Intelligence redesign) put currency
 * figures front and center, where a bare number with no symbol reads as an
 * omission, not a design choice.
 */
export function formatMetricValue(value: number, unit: string | undefined, currency?: string): string {
  switch (unit) {
    case 'percentage':
      return `${round(value, 1)}%`;
    case 'currency':
      return formatCurrency(value, currency);
    case 'count':
      return String(Math.round(value));
    default:
      return String(round(value, 2));
  }
}

function formatCurrency(value: number, currency?: string): string {
  const rounded = round(value, 2);
  if (!currency) {
    return rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rounded);
  } catch {
    // Hotel.currency is a free-text admin field (no ISO-4217 validation on
    // the form) — an invalid code throws a RangeError inside
    // Intl.NumberFormat. Fall back to the plain number with the raw string
    // appended rather than letting a bad currency code crash the report.
    return `${rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
