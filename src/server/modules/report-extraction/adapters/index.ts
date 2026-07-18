import type { ExtractionAdapter } from '../types';
import { managerFlashAdapter } from './manager-flash';
import { genericFallbackAdapter } from './generic-fallback';

/**
 * v0.1 scope (Roadmap M3, DECISIONS.md D22): only Manager Flash has a
 * type-specific adapter. Reservation Statistics / Open Balance / Reservation
 * Statistics 1 fall through to the generic fallback until their adapters
 * ship in v0.2 — this is a deliberate scope narrowing, not an oversight.
 */
const ADAPTERS: ExtractionAdapter[] = [managerFlashAdapter];

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

export { managerFlashAdapter, genericFallbackAdapter };
