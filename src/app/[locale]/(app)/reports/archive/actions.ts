'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership, resolveHotelScope } from '@/server/modules/hotels/access';
import { deleteReportUpload, type DeleteReportResult } from '@/server/modules/reports/commands';
import type { Locale } from '@/i18n/config';

export async function deleteReportAction(
  locale: Locale,
  hotelId: string,
  reportUploadId: string,
  _prevState: DeleteReportResult
): Promise<DeleteReportResult> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }
  const [scope, membership] = await Promise.all([resolveHotelScope(user), getActiveMembership(user.id)]);
  const role = user.isSuperAdmin ? 'SUPER_ADMIN' : membership?.role ?? '';

  const result = await deleteReportUpload(user, scope, hotelId, reportUploadId, role);
  revalidatePath(`/${locale}/reports/archive`);
  revalidatePath(`/${locale}/reports/upload`);
  return result;
}
