import { prisma } from '@/lib/prisma';
import { audit } from '@/server/modules/audit';
import type { User } from '@prisma/client';

/**
 * Centralized tenant-scoping resolution (Architecture §4, Constitution §2/§6).
 *
 * Every module function that reads or writes hotel-owned data must obtain its
 * authorized hotel set through this function — never by trusting a hotelId
 * supplied directly from client input. This is the single seam that makes
 * cross-tenant leakage a structural non-issue rather than a per-route habit.
 */
export type HotelScope =
  | { kind: 'super_admin' }
  | { kind: 'scoped'; hotelIds: string[] };

export async function resolveHotelScope(user: User): Promise<HotelScope> {
  if (user.isSuperAdmin) {
    return { kind: 'super_admin' };
  }

  const memberships = await prisma.hotelMembership.findMany({
    where: { userId: user.id, status: 'active' },
    select: { hotelId: true },
  });

  return { kind: 'scoped', hotelIds: memberships.map((m) => m.hotelId) };
}

/** Throws if the resolved scope does not include hotelId. */
export function assertHotelAccess(scope: HotelScope, hotelId: string): void {
  if (scope.kind === 'super_admin') return;
  if (!scope.hotelIds.includes(hotelId)) {
    throw new Error('FORBIDDEN: no membership for this hotel');
  }
}

/**
 * Explicit, distinct, always-audited path for Super Admin cross-hotel access
 * (Architecture §4 "Super Admin path"). Calling this — rather than having the
 * caller silently rely on `scope.kind === 'super_admin'` — is what makes the
 * bypass an intentional, logged action instead of an easy-to-forget branch.
 */
export async function withSuperAdminScope<T>(
  user: User,
  hotelId: string | null,
  action: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!user.isSuperAdmin) {
    throw new Error('FORBIDDEN: super admin scope requires isSuperAdmin');
  }
  const result = await fn();
  await audit({
    hotelId,
    userId: user.id,
    action: `super_admin.${action}`,
    metadata: {},
  });
  return result;
}
