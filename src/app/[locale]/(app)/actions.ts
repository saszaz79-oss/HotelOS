'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { logout } from '@/server/modules/auth/service';
import type { Locale } from '@/i18n/config';

export async function logoutAction(locale: Locale) {
  const user = await getCurrentUser();
  if (user) {
    await logout(user.id);
  }
  redirect(`/${locale}/login`);
}
