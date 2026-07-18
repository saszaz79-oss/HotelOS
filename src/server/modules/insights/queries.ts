import { prisma } from '@/lib/prisma';

/** CQRS convention (Architecture §28): reads only. */
export async function getLatestInsight(hotelId: string) {
  return prisma.insight.findFirst({
    where: { hotelId },
    orderBy: { insightDate: 'desc' },
    include: {
      alerts: { where: { status: 'open' }, orderBy: { severity: 'asc' } },
      recommendations: { where: { status: 'open' }, orderBy: { priority: 'asc' } },
    },
  });
}
