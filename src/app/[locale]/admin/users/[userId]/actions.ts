'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { resetUserPassword, setUserStatus, forceChangePassword, changeUserRole } from '@/server/modules/users/commands';
import type { Locale } from '@/i18n/config';
import type { HotelRole } from '@prisma/client';

export interface ResetPasswordActionState {
  temporaryPassword?: string;
}

// Session can expire between page load and form submit (this page is only
// reachable by a Super Admin whose session was valid when the page
// rendered) — send them to sign in again instead of an uncaught throw,
// which produces a generic 500 (same crash class as digest 881976446).
export async function resetPasswordAction(
  locale: Locale,
  userId: string,
  _prevState: ResetPasswordActionState
): Promise<ResetPasswordActionState> {
  const actor = await getCurrentUser();
  if (!actor || !actor.isSuperAdmin) {
    redirect(`/${locale}/login`);
  }

  const result = await resetUserPassword(actor, userId);
  revalidatePath(`/${locale}/admin/users/${userId}`);
  return { temporaryPassword: result.temporaryPassword };
}

export async function setUserStatusAction(locale: Locale, userId: string, status: 'active' | 'disabled'): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || !actor.isSuperAdmin) {
    redirect(`/${locale}/login`);
  }

  await setUserStatus(actor, userId, status);
  revalidatePath(`/${locale}/admin/users/${userId}`);
}

export async function forceChangePasswordAction(locale: Locale, userId: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || !actor.isSuperAdmin) {
    redirect(`/${locale}/login`);
  }

  await forceChangePassword(actor, userId);
  revalidatePath(`/${locale}/admin/users/${userId}`);
}

export async function changeRoleAction(locale: Locale, userId: string, membershipId: string, formData: FormData): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || !actor.isSuperAdmin) {
    redirect(`/${locale}/login`);
  }

  const role = formData.get('role') as HotelRole;
  await changeUserRole(actor, membershipId, role);
  revalidatePath(`/${locale}/admin/users/${userId}`);
}
