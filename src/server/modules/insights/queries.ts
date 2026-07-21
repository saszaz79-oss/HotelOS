import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/** CQRS convention (Architecture §28): reads only. */
export const getLatestInsight = cache(async (hotelId: string) => {
  return prisma.insight.findFirst({
    where: { hotelId },
    orderBy: { insightDate: 'desc' },
    include: {
      alerts: { where: { status: 'open' }, orderBy: { severity: 'asc' } },
      recommendations: { where: { status: 'open' }, orderBy: { priority: 'asc' } },
    },
  });
});
