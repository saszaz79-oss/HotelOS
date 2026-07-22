'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { resolveHotelScope } from '@/server/modules/hotels/access';
import { uploadReport, type UploadReportResult } from '@/server/modules/reports/commands';
import { prisma } from '@/lib/prisma';
import type { ReportUploadStatus } from '@prisma/client';
import type { Locale } from '@/i18n/config';
// Side-effect import: registers the extraction pipeline as a subscriber to
// `ReportUploaded` (Architecture §17) — see report-extraction/index.ts.
import '@/server/modules/report-extraction';

/**
 * One file per call — the upload UI drives its own per-file queue
 * (progress/retry/removal client-side) rather than submitting one big
 * batch, so a single failed file never blocks or has to be redone
 * alongside files that already succeeded.
 */
export async function uploadSingleReportAction(locale: Locale, hotelId: string, formData: FormData): Promise<UploadReportResult> {
  const user = await getCurrentUser();
  // Session can expire between page load and submit — redirect to sign in
  // again instead of an uncaught throw (same crash class as digest
  // 881976446/1047464761).
  if (!user) {
    redirect(`/${locale}/login`);
  }
  const scope = await resolveHotelScope(user);

  // Membership/hotel state can change between page load and submit (e.g.
  // the Platform Owner suspends the hotel or revokes membership mid-
  // session) — uploadReport()'s own assertHotelAccess() throws in that
  // case, which must never reach the caller uncaught (same discipline as
  // the login-expiry check above).
  if (scope.kind !== 'super_admin' && !scope.hotelIds.includes(hotelId)) {
    redirect(`/${locale}/mission-control`);
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'EMPTY_FILE' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadReport({
    hotelId,
    uploadedByUserId: user.id,
    scope,
    originalFilename: file.name,
    mimeType: file.type,
    data: buffer,
  });

  revalidatePath(`/${locale}/reports/upload`);
  return result;
}

export interface UploadStatusResult {
  status: ReportUploadStatus | null;
  errorMessage: string | null;
}

/**
 * Read-only status poll for the upload queue UI — lets the client reflect
 * the async extraction pipeline's real progress (uploaded -> processing ->
 * needs_review/complete/error, now genuinely run in the background via
 * `after()` — see report-extraction/index.ts) instead of freezing at
 * "uploaded" the moment the request returns. Also surfaces the real
 * `ExtractionJob.errorMessage` on failure (Perf fix, Phase 1A) instead of
 * just a generic "processing failed" label, so a user deciding whether to
 * retry has something to go on.
 */
export async function getUploadStatusAction(hotelId: string, reportUploadId: string): Promise<UploadStatusResult> {
  const user = await getCurrentUser();
  if (!user) return { status: null, errorMessage: null };
  const scope = await resolveHotelScope(user);
  if (scope.kind !== 'super_admin' && !scope.hotelIds.includes(hotelId)) return { status: null, errorMessage: null };

  const upload = await prisma.reportUpload.findFirst({
    where: { id: reportUploadId, hotelId },
    select: {
      status: true,
      documents: { take: 1, select: { extractionJobs: { orderBy: { startedAt: 'desc' }, take: 1, select: { errorMessage: true } } } },
    },
  });
  return { status: upload?.status ?? null, errorMessage: upload?.documents[0]?.extractionJobs[0]?.errorMessage ?? null };
}
