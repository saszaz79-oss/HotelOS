import { after } from 'next/server';
import { subscribe } from '@/server/modules/events/bus';
import { processReportUpload } from './commands';

/**
 * Registers the extraction pipeline as a subscriber to `ReportUploaded`
 * (Architecture §17) — importing this module (side effect, done once from
 * the reports upload Server Action) is what wires "upload triggers
 * extraction" without `reports` calling `report-extraction` directly.
 *
 * Perf fix (Phase 1A): extraction used to run inline here, so the upload
 * Server Action's HTTP response waited on full PDF parsing. `after()` defers
 * the actual work until after the response is sent, using Vercel's
 * `waitUntil` under the hood — it still works called from inside this
 * subscriber (not just the top-level action) because it reads request
 * context via AsyncLocalStorage threaded through the whole awaited call
 * chain (action -> uploadReport -> publish -> this handler).
 */
subscribe<{ reportUploadId: string }>('ReportUploaded', async (event) => {
  after(() => processReportUpload(event.hotelId, event.payload.reportUploadId));
});

export * from './commands';
export * from './types';
