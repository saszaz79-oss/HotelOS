import { prisma } from '@/lib/prisma';

/**
 * Hotel Genome (Architecture §15) — v0.1 structured scope. This is a
 * disciplined query layer over data the platform already writes
 * (HotelMetric, TimelineEvent, AIConversation, Recommendation), not a new
 * store. Semantic (vector) retrieval is Roadmap v0.2+; behavioral pattern
 * modeling (seasonality, employee trends) is v0.3+, once real history
 * exists to model honestly (Constitution §4 — no fabricated patterns).
 *
 * Every result here must retain provenance back to its source record so a
 * later metric correction is reflected in genome retrieval rather than the
 * genome holding a stale fact indefinitely (Architecture §15 "Provenance").
 */

interface SimilarPeriodQuery {
  hotelId: string;
  metricKey: string;
  aroundDate: Date;
  /** e.g. 8 — "same weekday over the last 8 weeks" */
  lookbackOccurrences: number;
}

/** Finds prior values for the same metric on the same weekday, most recent first. */
export async function findSimilarWeekdayHistory({
  hotelId,
  metricKey,
  aroundDate,
  lookbackOccurrences,
}: SimilarPeriodQuery) {
  const targetWeekday = aroundDate.getDay();

  const candidates = await prisma.hotelMetric.findMany({
    where: { hotelId, metricKey, metricDate: { lt: aroundDate } },
    orderBy: { metricDate: 'desc' },
    take: lookbackOccurrences * 7, // over-fetch, then filter by weekday below
    include: { sourceReportDocument: true },
  });

  return candidates
    .filter((m) => m.metricDate.getDay() === targetWeekday)
    .slice(0, lookbackOccurrences);
}

/** Prior instances of the same alert category for this hotel — "has this happened before." */
export async function findPriorAlertOccurrences(hotelId: string, category: string, before: Date) {
  return prisma.alert.findMany({
    where: { hotelId, category, createdAt: { lt: before } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}

/** Outcome tracking for recommendations (Architecture §15 v0.1 scope: seed of recommendation-outcome genome input). */
export async function markRecommendationOutcome(
  recommendationId: string,
  outcome: 'accepted' | 'dismissed' | 'superseded'
) {
  return prisma.recommendation.update({
    where: { id: recommendationId },
    data: { status: outcome },
  });
}
