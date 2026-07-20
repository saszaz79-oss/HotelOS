'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { resolveHotelScope } from '@/server/modules/hotels/access';
import { uploadReport, type UploadReportResult } from '@/server/modules/reports/commands';
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
