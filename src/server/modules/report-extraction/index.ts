import { subscribe } from '@/server/modules/events/bus';
import { processReportUpload } from './commands';

/**
 * Registers the extraction pipeline as a subscriber to `ReportUploaded`
 * (Architecture §17) — importing this module (side effect, done once from
 * the reports upload Server Action) is what wires "upload triggers
 * extraction" without `reports` calling `report-extraction` directly.
 */
subscribe<{ reportUploadId: string }>('ReportUploaded', async (event) => {
  await processReportUpload(event.hotelId, event.payload.reportUploadId);
});

export * from './commands';
export * from './types';
