'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { resetUserPassword, setUserStatus } from '@/server/modules/users/commands';
import type { Locale } from '@/i18n/config';

export interface ResetPasswordActionState {
  temporaryPassword?: string;
}

export async function resetPasswordAction(
  locale: Locale,
  userId: string,
  _prevState: ResetPasswordActionState
): Promise<ResetPasswordActionState> {
  const actor = await getCurrentUser();
  if (!actor || !actor.isSuperAdmin) throw new Error('FORBIDDEN');

  const result = await resetUserPassword(actor, userId);
  revalidatePath(`/${locale}/admin/users/${userId}`);
  return { temporaryPassword: result.temporaryPassword };
}

export async function setUserStatusAction(locale: Locale, userId: string, status: 'active' | 'disabled'): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || !actor.isSuperAdmin) throw new Error('FORBIDDEN');

  await setUserStatus(actor, userId, status);
  revalidatePath(`/${locale}/admin/users/${userId}`);
}
