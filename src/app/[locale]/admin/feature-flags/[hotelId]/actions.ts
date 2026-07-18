'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { setModuleEnabled } from '@/server/modules/feature-flags';
import { audit } from '@/server/modules/audit';
import type { Locale } from '@/i18n/config';

export async function toggleModuleAction(
  locale: Locale,
  hotelId: string,
  moduleKey: string,
  currentlyEnabled: boolean
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) throw new Error('FORBIDDEN');

  await setModuleEnabled(hotelId, moduleKey, !currentlyEnabled);
  await audit({
    hotelId,
    userId: user.id,
    action: 'admin.feature_flag_toggle',
    metadata: { moduleKey, enabled: !currentlyEnabled },
  });

  revalidatePath(`/${locale}/admin/feature-flags/${hotelId}`);
}
