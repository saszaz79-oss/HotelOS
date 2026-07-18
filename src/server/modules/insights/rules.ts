import type { Prisma } from '@prisma/client';

interface MetricPoint {
  key: string;
  value: number | null;
  metricDate: Date;
  sourceReportDocumentId: string | null;
}

export interface RuleAlert {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  messageEn: string;
  messageAr: string;
  relatedMetricKey: string | null;
}

export interface RuleRecommendation {
  priority: number;
  textEn: string;
  textAr: string;
  suggestedActionEn: string;
  suggestedActionAr: string;
  confidence: number;
  category: 'risk' | 'opportunity' | 'action';
  supportingMetrics: Prisma.InputJsonValue;
}

function metric(points: MetricPoint[], key: string): MetricPoint | undefined {
  return points.find((p) => p.key === key && p.value !== null);
}

function supporting(...points: (MetricPoint | undefined)[]): Prisma.InputJsonValue {
  return points
    .filter((p): p is MetricPoint => !!p)
    .map((p) => ({ metricKey: p.key, value: p.value, metricDate: p.metricDate.toISOString(), sourceReportDocumentId: p.sourceReportDocumentId })) as unknown as Prisma.InputJsonValue;
}

/**
 * Decision Engine rules (Architecture §31, PRD's risks/opportunities
 * requirement). v0.1 recommendations are deterministic, not AI-generated —
 * confidence reflects rule certainty (always 1.0: the rule either fires on
 * verified data or it doesn't), which is what keeps every recommendation
 * traceable back to specific metric values (Constitution truth test).
 */
export function evaluateRules(
  points: MetricPoint[],
  completenessScore: number | null
): { alerts: RuleAlert[]; recommendations: RuleRecommendation[] } {
  const alerts: RuleAlert[] = [];
  const recommendations: RuleRecommendation[] = [];

  const occupancy = metric(points, 'occupancy_pct');
  const adr = metric(points, 'adr');
  const openBalance = metric(points, 'open_balance');
  const totalRevenue = metric(points, 'total_revenue');

  if (occupancy && occupancy.value! < 40) {
    recommendations.push({
      priority: 1,
      textEn: `Occupancy is critically low at ${occupancy.value}%.`,
      textAr: `نسبة الإشغال منخفضة بشكل حرج عند ${occupancy.value}%.`,
      suggestedActionEn: 'Review pricing and promotional strategy for the affected period.',
      suggestedActionAr: 'راجع استراتيجية التسعير والعروض الترويجية للفترة المتأثرة.',
      confidence: 1,
      category: 'risk',
      supportingMetrics: supporting(occupancy),
    });
  } else if (occupancy && occupancy.value! > 85) {
    recommendations.push({
      priority: 2,
      textEn: `Occupancy is high at ${occupancy.value}%${adr ? `, with ADR at ${adr.value}` : ''}.`,
      textAr: `نسبة الإشغال مرتفعة عند ${occupancy.value}%${adr ? ` بمتوسط سعر غرفة ${adr.value}` : ''}.`,
      suggestedActionEn: 'Consider a rate increase given strong demand.',
      suggestedActionAr: 'يُنصح بزيادة الأسعار نظراً لارتفاع الطلب.',
      confidence: 1,
      category: 'opportunity',
      supportingMetrics: supporting(occupancy, adr),
    });
  }

  if (openBalance) {
    const ratio = totalRevenue?.value ? openBalance.value! / totalRevenue.value : null;
    const isHigh = ratio !== null ? ratio > 0.3 : openBalance.value! > 20000;
    if (isHigh) {
      alerts.push({
        severity: 'warning',
        category: 'finance',
        messageEn: `Open balance is ${ratio !== null ? `${Math.round(ratio * 100)}% of total revenue` : `${openBalance.value}`}.`,
        messageAr: `الرصيد المفتوح ${ratio !== null ? `يمثل ${Math.round(ratio * 100)}% من إجمالي الإيرادات` : `${openBalance.value}`}.`,
        relatedMetricKey: 'open_balance',
      });
      recommendations.push({
        priority: 2,
        textEn: `Open balance is elevated${ratio !== null ? ` (${Math.round(ratio * 100)}% of total revenue)` : ''}.`,
        textAr: `الرصيد المفتوح مرتفع${ratio !== null ? ` (${Math.round(ratio * 100)}% من إجمالي الإيرادات)` : ''}.`,
        suggestedActionEn: 'Review outstanding folios and follow up on collections.',
        suggestedActionAr: 'راجع الفواتير المستحقة وتابع عمليات التحصيل.',
        confidence: 1,
        category: 'risk',
        supportingMetrics: supporting(openBalance, totalRevenue),
      });
    }
  }

  if (completenessScore !== null && completenessScore < 0.5) {
    alerts.push({
      severity: 'warning',
      category: 'data_quality',
      messageEn: `The source report for this date is only ${Math.round(completenessScore * 100)}% complete — verify figures against the original PDF.`,
      messageAr: `التقرير المصدر لهذا التاريخ مكتمل بنسبة ${Math.round(completenessScore * 100)}% فقط — تحقق من الأرقام مقابل ملف PDF الأصلي.`,
      relatedMetricKey: null,
    });
  }

  return { alerts, recommendations };
}
