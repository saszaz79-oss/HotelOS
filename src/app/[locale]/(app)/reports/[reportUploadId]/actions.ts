'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { resolveHotelScope, type HotelScope } from '@/server/modules/hotels/access';
import { getReportUpload } from '@/server/modules/reports/queries';
import { updateExtractedField } from '@/server/modules/report-extraction/review-commands';
import { processReportUpload } from '@/server/modules/report-extraction/commands';
import { normalizeReportDocument } from '@/server/modules/metrics/commands';
import { deleteReportUpload, type DeleteReportResult } from '@/server/modules/reports/commands';
import { audit } from '@/server/modules/audit';
import { getActiveMembership } from '@/server/modules/hotels/access';
import type { Locale } from '@/i18n/config';
// Side-effect import: registers the insights recomputation subscriber on
// `MetricsExtracted` (Architecture §17) — see insights/index.ts.
import '@/server/modules/insights';

// Redirects (never throws) on a stale/cross-tenant bound action — e.g. the
// caller's hotel membership was revoked between page load and submit. This
// is the same "no uncaught exception from a server action" discipline
// applied to every other action in this codebase (Constitution, §M2 fix
// history) — assertHotelAccess()'s throw is fine deep in a command function
// but never at the top of a directly form-bound action.
function hasHotelAccess(scope: HotelScope, hotelId: string): boolean {
  return scope.kind === 'super_admin' || scope.hotelIds.includes(hotelId);
}

export async function updateFieldAction(
  locale: Locale,
  hotelId: string,
  reportUploadId: string,
  reportDocumentId: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const scope = await resolveHotelScope(user);
  if (!hasHotelAccess(scope, hotelId)) {
    redirect(`/${locale}/mission-control`);
  }

  // Defense in depth: confirm the document actually belongs to this
  // hotel/upload before writing, even though the form only ever renders
  // fields for the caller's own hotel (§4).
  const upload = await getReportUpload(hotelId, reportUploadId);
  if (!upload || !upload.documents.some((d) => d.id === reportDocumentId)) {
    redirect(`/${locale}/mission-control`);
  }

  const metricKey = String(formData.get('metricKey'));
  const rawValue = String(formData.get('value'));
  const value = rawValue === '' ? null : Number(rawValue);

  await updateExtractedField(hotelId, reportDocumentId, metricKey, Number.isNaN(value) ? null : value, user.id);

  await audit({
    hotelId,
    userId: user.id,
    action: 'report.field_correction',
    metadata: { reportDocumentId, metricKey, value },
  });

  revalidatePath(`/${locale}/reports/${reportUploadId}`);
  revalidatePath(`/${locale}/timeline`);
}

export async function finalizeReportAction(
  locale: Locale,
  hotelId: string,
  reportUploadId: string,
  reportDocumentId: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const scope = await resolveHotelScope(user);
  if (!hasHotelAccess(scope, hotelId)) {
    redirect(`/${locale}/mission-control`);
  }

  const upload = await getReportUpload(hotelId, reportUploadId);
  if (!upload || !upload.documents.some((d) => d.id === reportDocumentId)) {
    redirect(`/${locale}/mission-control`);
  }

  const confirmedReportDate = new Date(String(formData.get('confirmedReportDate')));
  if (Number.isNaN(confirmedReportDate.getTime())) {
    // Native <input type="date" required> makes this practically
    // unreachable client-side; a redirect (not a throw) keeps it that way
    // for any other caller of this action too.
    redirect(`/${locale}/reports/${reportUploadId}`);
  }

  await normalizeReportDocument(hotelId, reportDocumentId, confirmedReportDate, user.id);

  revalidatePath(`/${locale}/reports/${reportUploadId}`);
  revalidatePath(`/${locale}/mission-control`);
}

/**
 * Manual recovery path for a job left stuck in `error` (Perf fix, Phase 1A) —
 * `after()`-deferred extraction has no supervisor that retries on its own if
 * the underlying compute is killed mid-work, so a human-triggered retry is
 * the actual failure-recovery mechanism, not a queue's automatic redelivery.
 */
export async function retryExtractionAction(locale: Locale, hotelId: string, reportUploadId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const scope = await resolveHotelScope(user);
  if (!hasHotelAccess(scope, hotelId)) {
    redirect(`/${locale}/mission-control`);
  }

  const upload = await getReportUpload(hotelId, reportUploadId);
  if (!upload || upload.status !== 'error') {
    redirect(`/${locale}/reports/${reportUploadId}`);
  }

  after(() => processReportUpload(hotelId, reportUploadId));
  revalidatePath(`/${locale}/reports/${reportUploadId}`);
}

export async function deleteReportFromDetailAction(
  locale: Locale,
  hotelId: string,
  reportUploadId: string,
  _prevState: DeleteReportResult
): Promise<DeleteReportResult> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const [scope, membership] = await Promise.all([resolveHotelScope(user), getActiveMembership(user.id)]);
  const role = user.isSuperAdmin ? 'SUPER_ADMIN' : membership?.role ?? '';

  const result = await deleteReportUpload(user, scope, hotelId, reportUploadId, role);
  if (result.ok) {
    revalidatePath(`/${locale}/reports/archive`);
    revalidatePath(`/${locale}/reports/upload`);
    redirect(`/${locale}/reports/archive`);
  }
  return result;
}
