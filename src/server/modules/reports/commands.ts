import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { storage, reportStorageKey } from '@/server/modules/storage';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { publish } from '@/server/modules/events/bus';
import { audit } from '@/server/modules/audit';
import { isModuleEnabled } from '@/server/modules/feature-flags';
import { assertHotelAccess, type HotelScope } from '@/server/modules/hotels/access';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, matches next.config.mjs serverActions.bodySizeLimit
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);

export type UploadReportResult =
  | { ok: true; reportUploadId: string }
  | {
      ok: false;
      error: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'EMPTY_FILE' | 'DUPLICATE' | 'MODULE_DISABLED' | 'STORAGE_UNAVAILABLE';
    };

interface UploadReportInput {
  hotelId: string;
  uploadedByUserId: string;
  scope: HotelScope;
  originalFilename: string;
  mimeType: string;
  data: Buffer;
}

/**
 * Report Upload stage only (Roadmap M2) — type detection, extraction, and
 * validation happen in later stages (M3, see queries.ts / extraction.ts) and
 * are not implemented here. This function's job ends at a stored,
 * deduplicated ReportUpload record.
 *
 * CQRS naming convention (Architecture §28): this file holds commands
 * (state-changing) only; queries.ts holds reads.
 */
export async function uploadReport(input: UploadReportInput): Promise<UploadReportResult> {
  assertHotelAccess(input.scope, input.hotelId);

  if (!(await isModuleEnabled(input.hotelId, 'reports'))) {
    return { ok: false, error: 'MODULE_DISABLED' };
  }

  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    return { ok: false, error: 'INVALID_FILE_TYPE' };
  }
  if (input.data.length === 0) {
    return { ok: false, error: 'EMPTY_FILE' };
  }
  if (input.data.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'FILE_TOO_LARGE' };
  }

  const checksumSha256 = createHash('sha256').update(input.data).digest('hex');

  // Exact-duplicate protection at the upload level (PRD §4). Type/date-aware
  // duplicate detection on ReportDocument is a later-stage concern (M3).
  const existing = await prisma.reportUpload.findFirst({
    where: { hotelId: input.hotelId, checksumSha256, status: { not: 'error' } },
  });
  if (existing) {
    return { ok: false, error: 'DUPLICATE' };
  }

  const reportUploadId = randomUUID();
  const storageKey = reportStorageKey(input.hotelId, reportUploadId, input.originalFilename);

  try {
    await storage.put(storageKey, input.data, input.mimeType);
  } catch (err) {
    // Never let a storage-layer failure (misconfigured driver, unavailable
    // backend, transient write error) surface as an uncaught 500 — this is
    // exactly what produced digest 1047464761 in production. Full detail
    // stays server-side only; the caller sees a safe, typed result.
    console.error('[reports.uploadReport] storage.put failed', {
      hotelId: input.hotelId,
      reportUploadId,
      storageKey,
      error: err,
    });
    return { ok: false, error: 'STORAGE_UNAVAILABLE' };
  }

  await prisma.reportUpload.create({
    data: {
      id: reportUploadId,
      hotelId: input.hotelId,
      uploadedByUserId: input.uploadedByUserId,
      originalFilename: input.originalFilename,
      storageKey,
      fileSizeBytes: input.data.length,
      checksumSha256,
      mimeType: input.mimeType,
      status: 'uploaded',
    },
  });

  await publishTimelineEvent({
    hotelId: input.hotelId,
    eventType: 'report_uploaded',
    actorUserId: input.uploadedByUserId,
    payload: { originalFilename: input.originalFilename },
    sourceRef: reportUploadId,
  });

  await publish({
    type: 'ReportUploaded',
    hotelId: input.hotelId,
    payload: { reportUploadId, originalFilename: input.originalFilename },
    causationRef: reportUploadId,
  });

  await audit({
    hotelId: input.hotelId,
    userId: input.uploadedByUserId,
    action: 'report.upload',
    metadata: { reportUploadId, originalFilename: input.originalFilename },
  });

  return { ok: true, reportUploadId };
}
