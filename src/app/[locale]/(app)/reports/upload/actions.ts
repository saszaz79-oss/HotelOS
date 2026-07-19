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

export interface UploadActionState {
  results: { filename: string; result: UploadReportResult }[];
}

export async function uploadReportsAction(
  locale: Locale,
  hotelId: string,
  _prevState: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const user = await getCurrentUser();
  // Session can expire between page load and submit — redirect to sign in
  // again instead of an uncaught throw (same crash class as digest
  // 881976446/1047464761).
  if (!user) {
    redirect(`/${locale}/login`);
  }
  const scope = await resolveHotelScope(user);

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  const results: UploadActionState['results'] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadReport({
      hotelId,
      uploadedByUserId: user.id,
      scope,
      originalFilename: file.name,
      mimeType: file.type,
      data: buffer,
    });
    results.push({ filename: file.name, result });
  }

  revalidatePath(`/${locale}/reports/upload`);
  return { results };
}
