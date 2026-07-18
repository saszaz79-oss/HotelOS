import { prisma } from '@/lib/prisma';

/** Super Admin Console queries — cross-hotel by design (see validation/queries.ts precedent, DECISIONS.md D33/D36); callers must gate to Super Admin. */
export async function listHotels() {
  return prisma.hotel.findMany({
    orderBy: { createdAt: 'desc' },
    include: { subscription: true, _count: { select: { memberships: true } } },
  });
}

export async function getHotelWithDetails(hotelId: string) {
  return prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      subscription: true,
      memberships: { include: { user: { select: { id: true, username: true, displayName: true, status: true } } } },
    },
  });
}
