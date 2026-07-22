import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { storage, reportStorageKey } from '@/server/modules/storage';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { publish } from '@/server/modules/events/bus';
import { audit } from '@/server/modules/audit';
import { isModuleEnabled } from '@/server/modules/feature-flags';
import { assertHotelAccess, type HotelScope } from '@/server/modules/hotels/access';
import { notifyUser } from '@/server/modules/notifications/commands';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, matches next.config.mjs serverActions.bodySizeLimit
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);

export type UploadReportResult =
  | { ok: true; reportUploadId: string }
  | {
      ok: false;
      error:
        | 'INVALID_FILE_TYPE'
        | 'FILE_TOO_LARGE'
        | 'EMPTY_FILE'
        | 'DUPLICATE'
        | 'MODULE_DISABLED'
        | 'STORAGE_UNAVAILABLE'
        | 'UPLOAD_FAILED';
    };

interface UploadReportInput {
  hotelId: string;
  uploadedByUserId: string;
  scope: HotelScope;
  originalFilename: string;
  mimeType: string;
  data: Buffer;
  // Tags this upload to the hotel's current Analysis Session (EDI Phase 2) —
  // optional so this function stays usable for any future non-session
  // upload path too; nullable on ReportUpload itself, so omitting it is a
  // valid, meaningful state, not an error.
  analysisSessionId?: string;
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

  try {
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
        analysisSessionId: input.analysisSessionId ?? null,
      },
    });
  } catch (err) {
    // The file write succeeded but the DB record didn't — without cleanup
    // this is a permanently orphaned file (real storage cost, and its
    // reportUploadId-keyed path can never be legitimately reused). Best-
    // effort delete; a cleanup failure is logged but must not mask the
    // original database error from the caller.
    console.error('[reports.uploadReport] reportUpload.create failed after storage.put succeeded — deleting orphaned file', {
      hotelId: input.hotelId,
      reportUploadId,
      storageKey,
      error: err,
    });
    try {
      await storage.delete(storageKey);
    } catch (cleanupErr) {
      console.error('[reports.uploadReport] orphaned-file cleanup also failed — manual cleanup needed', {
        hotelId: input.hotelId,
        reportUploadId,
        storageKey,
        error: cleanupErr,
      });
    }
    return { ok: false, error: 'UPLOAD_FAILED' };
  }

  // The core artifact (file + DB record) is safe past this point. Timeline/
  // event-bus/audit are side effects of a successful upload, not part of
  // its correctness — a failure here shouldn't turn an actually-successful
  // upload into an error response to the user.
  try {
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

    await notifyUser(input.uploadedByUserId, input.hotelId, 'upload_completed', {
      titleEn: 'Report uploaded',
      titleAr: 'تم رفع التقرير',
      bodyEn: input.originalFilename,
      bodyAr: input.originalFilename,
      sourceRef: reportUploadId,
    });
  } catch (err) {
    console.error('[reports.uploadReport] post-upload side effect failed (timeline/event/audit) — upload itself succeeded', {
      hotelId: input.hotelId,
      reportUploadId,
      error: err,
    });
  }

  return { ok: true, reportUploadId };
}

export type DeleteReportResult =
  | { ok: true }
  | { ok: false; error: 'FORBIDDEN' | 'NOT_FOUND' | 'ALREADY_FINALIZED' };

/**
 * Deleting a finalized report is refused rather than attempted: once a
 * ReportDocument has HotelMetric rows pointing at it as their source
 * (sourceReportDocumentId has no cascade — see schema), deleting the
 * document would either fail on the FK or silently orphan real,
 * already-live metrics. Only pre-finalization uploads (never reached
 * 'complete') can be removed this way.
 */
export async function deleteReportUpload(
  actingUser: { id: string },
  scope: HotelScope,
  hotelId: string,
  reportUploadId: string,
  role: string
): Promise<DeleteReportResult> {
  assertHotelAccess(scope, hotelId);
  if (role !== 'HOTEL_ADMIN' && scope.kind !== 'super_admin') {
    return { ok: false, error: 'FORBIDDEN' };
  }

  const upload = await prisma.reportUpload.findFirst({ where: { id: reportUploadId, hotelId } });
  if (!upload) {
    return { ok: false, error: 'NOT_FOUND' };
  }
  if (upload.status === 'complete') {
    return { ok: false, error: 'ALREADY_FINALIZED' };
  }

  try {
    await storage.delete(upload.storageKey);
  } catch (err) {
    console.error('[reports.deleteReportUpload] storage.delete failed — proceeding with DB delete regardless', {
      hotelId,
      reportUploadId,
      storageKey: upload.storageKey,
      error: err,
    });
  }

  // ReportDocument and ExtractionJob cascade from this delete (schema
  // onDelete: Cascade); TimelineEvent.sourceRef is a plain string, not an
  // FK, so historical timeline entries simply keep pointing at a now-gone id.
  await prisma.reportUpload.delete({ where: { id: reportUploadId } });

  await audit({
    hotelId,
    userId: actingUser.id,
    action: 'report.delete',
    metadata: { reportUploadId, originalFilename: upload.originalFilename },
  });

  return { ok: true };
}
