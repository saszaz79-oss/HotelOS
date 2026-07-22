import { prisma } from '@/lib/prisma';
import type { HotelStatus, Prisma } from '@prisma/client';

export interface ListHotelsFilter {
  search?: string;
  status?: HotelStatus;
}

/** Super Admin Console queries — cross-hotel by design (see validation/queries.ts precedent, DECISIONS.md D33/D36); callers must gate to Super Admin. */
export async function listHotels(filter: ListHotelsFilter = {}) {
  const where: Prisma.HotelWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: 'insensitive' } },
      { city: { contains: filter.search, mode: 'insensitive' } },
      { country: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  return prisma.hotel.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { subscription: true, _count: { select: { memberships: true, reportUploads: true } } },
  });
}

/**
 * Lightweight id/name(/status) list for simple pickers (new-user hotel
 * dropdown, feature-flags hotel list) — these never need `listHotels`'s
 * subscription join or the two `_count` aggregates it computes for the
 * admin hotels table, so they shouldn't pay for them (Zero-Lag Sprint).
 */
export async function listHotelOptions() {
  return prisma.hotel.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, status: true },
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
