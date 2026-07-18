'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { changePassword } from '@/server/modules/auth/service';
import type { Locale } from '@/i18n/config';

export interface ChangePasswordActionState {
  error?: 'INVALID_CURRENT_PASSWORD' | 'PASSWORD_TOO_SHORT' | 'MISMATCH';
}

export async function changePasswordAction(
  locale: Locale,
  _prevState: ChangePasswordActionState,
  formData: FormData
): Promise<ChangePasswordActionState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (newPassword !== confirmPassword) {
    return { error: 'MISMATCH' };
  }

  const result = await changePassword(user.id, currentPassword, newPassword);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(`/${locale}/mission-control`);
}
