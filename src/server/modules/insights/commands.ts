import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { computeHealthScore } from './scoring';
import { evaluateRules } from './rules';

/**
 * Recomputes Insight (health score + factors), Alert, and Recommendation
 * rows for one hotel/date from currently-stored HotelMetric values — the
 * Insights context (Architecture §27) owns this, triggered by `metrics`
 * publishing `MetricsExtracted` (Architecture §3 step 4, §17), never called
 * directly from `metrics` or `report-extraction`.
 */
export async function recomputeInsight(hotelId: string, date: Date): Promise<void> {
  const today = await prisma.hotelMetric.findMany({ where: { hotelId, metricDate: date } });
  if (today.length === 0) return;

  const previousRow = await prisma.hotelMetric.findFirst({
    where: { hotelId, metricDate: { lt: date } },
    orderBy: { metricDate: 'desc' },
    select: { metricDate: true },
  });
  const previous = previousRow
    ? await prisma.hotelMetric.findMany({ where: { hotelId, metricDate: previousRow.metricDate } })
    : null;

  const sourceDocIds = Array.from(new Set(today.map((m) => m.sourceReportDocumentId).filter((id): id is string => !!id)));
  const sourceDocs = sourceDocIds.length
    ? await prisma.reportDocument.findMany({ where: { id: { in: sourceDocIds } }, select: { completenessScore: true } })
    : [];
  const scores = sourceDocs.map((d) => d.completenessScore).filter((s): s is number => s !== null);
  const avgCompleteness = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const todayPoints = today.map((m) => ({ key: m.metricKey, value: m.value }));
  const previousPoints = previous?.map((m) => ({ key: m.metricKey, value: m.value })) ?? null;

  const { healthScore, factors } = computeHealthScore(todayPoints, previousPoints, avgCompleteness);

  const insight = await prisma.insight.upsert({
    where: { hotelId_insightDate: { hotelId, insightDate: date } },
    update: { healthScore, healthScoreFactors: factors as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    create: { hotelId, insightDate: date, healthScore, healthScoreFactors: factors as unknown as Prisma.InputJsonValue },
  });

  // Recompute means re-deriving alerts/recommendations fresh each time —
  // avoids duplicate spam when a report is re-finalized for the same date.
  await prisma.alert.deleteMany({ where: { insightId: insight.id } });
  await prisma.recommendation.deleteMany({ where: { insightId: insight.id } });

  const rulePoints = today.map((m) => ({
    key: m.metricKey,
    value: m.value,
    metricDate: m.metricDate,
    sourceReportDocumentId: m.sourceReportDocumentId,
  }));
  const { alerts, recommendations } = evaluateRules(rulePoints, avgCompleteness);

  // Individual create() calls (not createMany) — Validation Phase §6
  // requires every timeline event to reference its actual related entity,
  // not the parent Insight; createMany doesn't return generated ids.
  const primarySourceDocId = sourceDocIds[0] ?? null;

  for (const a of alerts) {
    const created = await prisma.alert.create({ data: { hotelId, insightId: insight.id, ...a } });
    await publishTimelineEvent({
      hotelId,
      eventType: 'alert_raised',
      payload: { category: a.category, severity: a.severity, alertId: created.id },
      sourceRef: primarySourceDocId,
    });
  }

  for (const r of recommendations) {
    const created = await prisma.recommendation.create({ data: { hotelId, insightId: insight.id, ...r } });
    await publishTimelineEvent({
      hotelId,
      eventType: 'recommendation_issued',
      payload: { category: r.category, priority: r.priority, recommendationId: created.id },
      sourceRef: created.id,
    });
  }
}
