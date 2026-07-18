import { subscribe } from '@/server/modules/events/bus';
import { recomputeInsight } from './commands';

/**
 * Subscribes to `MetricsExtracted` (Architecture §17, §3 step 4) — this is
 * what makes `metrics` and `insights` decoupled: `metrics` never calls this
 * module directly.
 */
subscribe<{ metricDate: string; reportDocumentId: string }>('MetricsExtracted', async (event) => {
  await recomputeInsight(event.hotelId, new Date(event.payload.metricDate));
});

export * from './commands';
export * from './queries';
