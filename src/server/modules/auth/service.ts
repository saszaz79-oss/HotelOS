import { z } from 'zod';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroySession } from './session';
import { audit } from '@/server/modules/audit';

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LoginResult =
  | { ok: true }
  | { ok: false; error: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' };

/**
 * Generic failure message regardless of whether the username exists
 * (Constitution §5, PRD §2.1) — never reveals which half of the credential
 * pair was wrong.
 */
export async function login(input: z.infer<typeof loginSchema>): Promise<LoginResult> {
  const { username, password } = loginSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  if (user.status !== 'active') {
    return { ok: false, error: 'ACCOUNT_DISABLED' };
  }

  await createSession(user.id);

  // `lastLoginAt` and the audit row are pure bookkeeping — nothing on the
  // post-login redirect path reads either, so they don't need to be on the
  // critical path (Zero-Lag Sprint, Incident #2). Deferring them with
  // after() removes 2 of what was 4 fully sequential DB round trips from
  // the user-facing login latency, same pattern as the upload pipeline's
  // background work in reports/upload/actions.ts.
  after(async () => {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ hotelId: null, userId: user.id, action: 'auth.login', metadata: {} });
  });

  return { ok: true };
}

export async function logout(userId: string): Promise<void> {
  await destroySession();
  await audit({ hotelId: null, userId, action: 'auth.logout', metadata: {} });
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: 'INVALID_CURRENT_PASSWORD' | 'PASSWORD_TOO_SHORT' };

/**
 * Self-service password change — required flow after a temporary password
 * is issued (Constitution: "first login must require changing the
 * temporary password"), also usable any time afterward. Requires the
 * current password even when mustChangePassword is set, so a stolen
 * temp-password link alone isn't enough to take over the account.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'PASSWORD_TOO_SHORT' };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { ok: false, error: 'INVALID_CURRENT_PASSWORD' };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
  await audit({ hotelId: null, userId, action: 'auth.password_change', metadata: {} });

  return { ok: true };
}
