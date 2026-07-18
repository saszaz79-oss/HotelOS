'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { resolveHotelScope, assertHotelAccess } from '@/server/modules/hotels/access';
import { getReportUpload } from '@/server/modules/reports/queries';
import { updateExtractedField } from '@/server/modules/report-extraction/commands';
import { normalizeReportDocument } from '@/server/modules/metrics/commands';
import { audit } from '@/server/modules/audit';
import type { Locale } from '@/i18n/config';
// Side-effect import: registers the insights recomputation subscriber on
// `MetricsExtracted` (Architecture §17) — see insights/index.ts.
import '@/server/modules/insights';

export async function updateFieldAction(
  locale: Locale,
  hotelId: string,
  reportUploadId: string,
  reportDocumentId: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');

  const scope = await resolveHotelScope(user);
  assertHotelAccess(scope, hotelId);

  // Defense in depth: confirm the document actually belongs to this
  // hotel/upload before writing, even though the form only ever renders
  // fields for the caller's own hotel (§4).
  const upload = await getReportUpload(hotelId, reportUploadId);
  if (!upload || !upload.documents.some((d) => d.id === reportDocumentId)) {
    throw new Error('NOT_FOUND');
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
  if (!user) throw new Error('UNAUTHENTICATED');

  const scope = await resolveHotelScope(user);
  assertHotelAccess(scope, hotelId);

  const upload = await getReportUpload(hotelId, reportUploadId);
  if (!upload || !upload.documents.some((d) => d.id === reportDocumentId)) {
    throw new Error('NOT_FOUND');
  }

  const confirmedReportDate = new Date(String(formData.get('confirmedReportDate')));
  if (Number.isNaN(confirmedReportDate.getTime())) {
    throw new Error('INVALID_DATE');
  }

  await normalizeReportDocument(hotelId, reportDocumentId, confirmedReportDate, user.id);

  revalidatePath(`/${locale}/reports/${reportUploadId}`);
  revalidatePath(`/${locale}/mission-control`);
}
