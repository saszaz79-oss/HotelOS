import { prisma } from '@/lib/prisma';
import type { Prisma, UserStatus } from '@prisma/client';

export interface ListUsersFilter {
  search?: string;
  status?: UserStatus;
}

/** Super Admin Console queries — cross-hotel; callers must gate to Super Admin. */
export async function listUsers(filter: ListUsersFilter = {}) {
  const where: Prisma.UserWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    where.OR = [
      { username: { contains: filter.search, mode: 'insensitive' } },
      { displayName: { contains: filter.search, mode: 'insensitive' } },
    ];
  }
  return prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { memberships: { include: { hotel: { select: { id: true, name: true } } } } },
  });
}

export async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { hotel: { select: { name: true } } } } },
  });
}
