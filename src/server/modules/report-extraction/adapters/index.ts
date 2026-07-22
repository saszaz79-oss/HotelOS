import type { ExtractionAdapter } from '../types';
import { managerFlashAdapter } from './manager-flash';
import { genericFallbackAdapter } from './generic-fallback';
import { reservationStatisticsAdapter } from './reservation-statistics';
import { historyForecastAdapter } from './history-forecast';
import { dayMtdYtdStatisticsAdapter } from './day-mtd-ytd-statistics';

/**
 * EDI Phase 2.5: all 4 required Analysis Session report types now have
 * real field-level extraction adapters, built and verified against real
 * samples of each — see docs/REPORT_ADAPTERS.md for what "real" means per
 * adapter (some, like History & Forecast and Day/MTD/YTD Statistics,
 * intentionally extract a smaller, honestly-scoped field set than Manager
 * Flash/Reservation Statistics because their real layouts are genuinely
 * harder to anchor reliably — see each adapter's own doc comment). Open
 * Balance / Reservation Statistics 1 still fall through to the generic
 * fallback — no adapter built for them yet (not required Analysis Session
 * slots).
 */
const ADAPTERS: ExtractionAdapter[] = [
  managerFlashAdapter,
  reservationStatisticsAdapter,
  historyForecastAdapter,
  dayMtdYtdStatisticsAdapter,
];

export function selectAdapter(text: string): ExtractionAdapter {
  let best = genericFallbackAdapter;
  let bestScore = genericFallbackAdapter.detect(text);

  for (const adapter of ADAPTERS) {
    const score = adapter.detect(text);
    if (score > bestScore) {
      best = adapter;
      bestScore = score;
    }
  }

  return best;
}

export { managerFlashAdapter, genericFallbackAdapter, reservationStatisticsAdapter, historyForecastAdapter, dayMtdYtdStatisticsAdapter };
