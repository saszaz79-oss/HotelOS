import { prisma } from '@/lib/prisma';

/** Super Admin Console queries — cross-hotel; callers must gate to Super Admin. */
export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { memberships: { include: { hotel: { select: { name: true } } } } },
  });
}

export async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { hotel: { select: { name: true } } } } },
  });
}
