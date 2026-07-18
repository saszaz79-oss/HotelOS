'use server';

import { redirect } from 'next/navigation';
import { login } from '@/server/modules/auth/service';
import type { Locale } from '@/i18n/config';

export interface LoginActionState {
  error?: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED';
}

export async function loginAction(
  locale: Locale,
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  const result = await login({ username, password });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect(`/${locale}/mission-control`);
}
