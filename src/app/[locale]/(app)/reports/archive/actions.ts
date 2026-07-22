'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership, type HotelScope } from '@/server/modules/hotels/access';
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
  // Derived from the single active membership rather than a separate
  // resolveHotelScope() call (Zero-Lag Sprint) — every non-super-admin user
  // has at most one active membership (the same fact getActiveMembership
  // already relies on), so scope.hotelIds is always exactly [membership.hotelId]
  // here; a second round trip to re-derive the same set was pure duplication.
  const membership = await getActiveMembership(user.id);
  const scope: HotelScope = user.isSuperAdmin ? { kind: 'super_admin' } : { kind: 'scoped', hotelIds: membership ? [membership.hotelId] : [] };
  const role = user.isSuperAdmin ? 'SUPER_ADMIN' : membership?.role ?? '';

  const result = await deleteReportUpload(user, scope, hotelId, reportUploadId, role);
  revalidatePath(`/${locale}/reports/archive`);
  revalidatePath(`/${locale}/reports/upload`);
  return result;
}
