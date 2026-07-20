'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { setModuleEnabled } from '@/server/modules/feature-flags';
import { audit } from '@/server/modules/audit';
import { notifyHotelMembers } from '@/server/modules/notifications/commands';
import type { Locale } from '@/i18n/config';

export async function toggleModuleAction(
  locale: Locale,
  hotelId: string,
  moduleKey: string,
  currentlyEnabled: boolean
): Promise<void> {
  const user = await getCurrentUser();
  // Session can expire between page load and form submit (this page is
  // only reachable by a Super Admin whose session was valid when the page
  // rendered) — send them to sign in again instead of an uncaught throw,
  // which produced a generic 500 in production (digest 881976446).
  if (!user || !user.isSuperAdmin) {
    redirect(`/${locale}/login`);
  }

  await setModuleEnabled(hotelId, moduleKey, !currentlyEnabled);
  await audit({
    hotelId,
    userId: user.id,
    action: 'admin.feature_flag_toggle',
    metadata: { moduleKey, enabled: !currentlyEnabled },
  });

  try {
    await notifyHotelMembers(hotelId, 'feature_toggled', {
      titleEn: `Feature "${moduleKey}" ${!currentlyEnabled ? 'enabled' : 'disabled'}`,
      titleAr: `تم ${!currentlyEnabled ? 'تفعيل' : 'تعطيل'} ميزة "${moduleKey}"`,
    });
  } catch (err) {
    console.error('[admin.toggleModuleAction] feature_toggled notification failed', { hotelId, moduleKey, error: err });
  }

  revalidatePath(`/${locale}/admin/feature-flags/${hotelId}`);
}
