import { prisma } from '@/lib/prisma';
import type { HotelRole, User } from '@prisma/client';
import { hashPassword, generateTemporaryPassword } from '@/server/modules/auth/password';
import { audit } from '@/server/modules/audit';
import { notifyUser } from '@/server/modules/notifications/commands';

function requireSuperAdmin(actingUser: User): void {
  if (!actingUser.isSuperAdmin) {
    throw new Error('FORBIDDEN: user administration requires Super Admin (Platform Owner)');
  }
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  hotelId: string;
  role: HotelRole;
}

export interface CreateUserResult {
  userId: string;
  username: string;
  temporaryPassword: string;
}

/** Platform Owner creates a Hotel User (any role) and assigns them to a hotel in one step. */
export async function createUser(actingUser: User, input: CreateUserInput): Promise<CreateUserResult> {
  requireSuperAdmin(actingUser);

  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) {
    throw new Error('USERNAME_TAKEN');
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { username: input.username, passwordHash, displayName: input.displayName, mustChangePassword: true },
    });
    await tx.hotelMembership.create({ data: { userId: created.id, hotelId: input.hotelId, role: input.role } });
    return created;
  });

  await audit({
    hotelId: input.hotelId,
    userId: actingUser.id,
    action: 'admin.user_create',
    metadata: { username: input.username, role: input.role, createdUserId: user.id },
  });

  return { userId: user.id, username: user.username, temporaryPassword };
}

export interface ResetPasswordResult {
  temporaryPassword: string;
}

/** Admin-triggered password reset (Super Admin Console requirement) — always issues a new temporary password, never lets the admin choose the user's password directly. */
export async function resetUserPassword(actingUser: User, targetUserId: string): Promise<ResetPasswordResult> {
  requireSuperAdmin(actingUser);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash, mustChangePassword: true },
  });
  // A reset password must invalidate existing sessions — otherwise a
  // compromised or ex-employee session would survive the reset.
  await prisma.session.deleteMany({ where: { userId: targetUserId } });

  await audit({ hotelId: null, userId: actingUser.id, action: 'admin.password_reset', metadata: { targetUserId } });

  try {
    await notifyUser(targetUserId, null, 'password_reset', {
      titleEn: 'Your password was reset',
      titleAr: 'تمت إعادة تعيين كلمة المرور الخاصة بك',
    });
  } catch (err) {
    console.error('[users.resetUserPassword] password_reset notification failed', { targetUserId, error: err });
  }

  return { temporaryPassword };
}

export async function setUserStatus(actingUser: User, targetUserId: string, status: 'active' | 'disabled'): Promise<void> {
  requireSuperAdmin(actingUser);
  await prisma.user.update({ where: { id: targetUserId }, data: { status } });
  if (status === 'disabled') {
    await prisma.session.deleteMany({ where: { userId: targetUserId } });
  }
  await audit({ hotelId: null, userId: actingUser.id, action: 'admin.user_status_change', metadata: { targetUserId, status } });
}

/**
 * Forces mustChangePassword=true without issuing a new password (unlike
 * resetUserPassword) — the user keeps their current password but is
 * required to change it on next login. Still invalidates existing
 * sessions so the requirement can't be bypassed by an already-open tab.
 */
export async function forceChangePassword(actingUser: User, targetUserId: string): Promise<void> {
  requireSuperAdmin(actingUser);
  await prisma.user.update({ where: { id: targetUserId }, data: { mustChangePassword: true } });
  await prisma.session.deleteMany({ where: { userId: targetUserId } });
  await audit({ hotelId: null, userId: actingUser.id, action: 'admin.password_change_forced', metadata: { targetUserId } });
}

export async function changeUserRole(actingUser: User, membershipId: string, role: HotelRole): Promise<void> {
  requireSuperAdmin(actingUser);
  const membership = await prisma.hotelMembership.update({
    where: { id: membershipId },
    data: { role },
  });
  await audit({
    hotelId: membership.hotelId,
    userId: actingUser.id,
    action: 'admin.user_role_change',
    metadata: { targetUserId: membership.userId, membershipId, role },
  });
}
