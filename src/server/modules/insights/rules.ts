import type { DecisionWindow, HotelDepartment, HotelRole, OpportunityValue, RiskSeverity, Prisma } from '@prisma/client';
import { classifySeverity, magnitudeRatio } from './classification';

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
  // Added Executive Decision Intelligence redesign — which hotel function
  // owns this, when applicable. Left null for alerts with no real
  // department owner (e.g. data_quality is a data-integrity flag, not a
  // hotel function's job) rather than guessed.
  department: HotelDepartment | null;
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
  // Added Analytics fix Phase 6 — who should act, by when, and what "solved"
  // looks like, all fixed per rule family (not free-form generated text),
  // so every recommendation stays mechanically checkable against
  // "no generic phrases" the same way textEn/textAr already are.
  owner: HotelRole;
  timeframe: string;
  expectedOutcomeEn: string;
  expectedOutcomeAr: string;
  // Added Executive Decision Intelligence redesign — same discipline as the
  // Phase 6 fields above: fixed per rule family, never free-form/AI-
  // generated. department is which hotel function is accountable (distinct
  // from owner, the internal HotelOS user role). severity only applies to
  // category:'risk' rules (via classifySeverity()); opportunityValue only
  // applies to category:'opportunity' rules (a fixed constant per rule
  // family, not a formula — see rule call sites). decisionWindow answers
  // "when must someone start acting," computed from priority + timeframe.
  department: HotelDepartment;
  severity: RiskSeverity | null;
  opportunityValue: OpportunityValue | null;
  decisionWindow: DecisionWindow;
}

function metric(points: MetricPoint[], key: string): MetricPoint | undefined {
  return points.find((p) => p.key === key && p.value !== null);
}

/**
 * Display-safe rounding for values interpolated straight into alert/
 * recommendation text (persisted as-is, unlike a page render which can
 * reformat on every read) — a computed value like ADR (room_revenue /
 * rooms_sold) is a repeating decimal far more often than not, and an
 * unrounded 307.575757575758 baked into stored text can never be fixed
 * later without regenerating the insight.
 */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
  const arrivals = metric(points, 'arrivals');
  const noShows = metric(points, 'no_shows');
  const cancellations = metric(points, 'cancellations');
  const complimentaryRooms = metric(points, 'complimentary_rooms');
  const houseUseRooms = metric(points, 'house_use_rooms');
  const outOfOrderRooms = metric(points, 'out_of_order_rooms');
  const outOfInventoryRooms = metric(points, 'out_of_inventory_rooms');
  const roomsAvailable = metric(points, 'rooms_available');

  if (occupancy && occupancy.value! < 40) {
    const occ = round(occupancy.value!, 1);
    recommendations.push({
      priority: 1,
      textEn: `Occupancy is critically low at ${occ}%.`,
      textAr: `نسبة الإشغال منخفضة بشكل حرج عند ${occ}%.`,
      suggestedActionEn: 'Review pricing and promotional strategy for the affected period.',
      suggestedActionAr: 'راجع استراتيجية التسعير والعروض الترويجية للفترة المتأثرة.',
      confidence: 1,
      category: 'risk',
      supportingMetrics: supporting(occupancy),
      owner: 'REVENUE_MANAGER',
      timeframe: 'Within 7 days',
      expectedOutcomeEn: `Occupancy above 40% (currently ${occ}%).`,
      expectedOutcomeAr: `نسبة إشغال أعلى من 40% (حالياً ${occ}%).`,
      department: 'REVENUE_MANAGEMENT',
      severity: classifySeverity(1, magnitudeRatio(40 - occupancy.value!, 40)),
      opportunityValue: null,
      // priority-1 risk: the right response starts today, independent of
      // the 7-day timeframe above (which is when the *outcome* should land).
      decisionWindow: 'IMMEDIATE',
    });
  } else if (occupancy && occupancy.value! > 85) {
    const occ = round(occupancy.value!, 1);
    const adrRounded = adr ? round(adr.value!, 2) : null;
    recommendations.push({
      priority: 2,
      textEn: `Occupancy is high at ${occ}%${adrRounded !== null ? `, with ADR at ${adrRounded}` : ''}.`,
      textAr: `نسبة الإشغال مرتفعة عند ${occ}%${adrRounded !== null ? ` بمتوسط سعر غرفة ${adrRounded}` : ''}.`,
      suggestedActionEn: 'Consider a rate increase given strong demand.',
      suggestedActionAr: 'يُنصح بزيادة الأسعار نظراً لارتفاع الطلب.',
      confidence: 1,
      category: 'opportunity',
      supportingMetrics: supporting(occupancy, adr),
      owner: 'REVENUE_MANAGER',
      timeframe: 'Within 3 days',
      expectedOutcomeEn: `Rate increase implemented while occupancy remains above 85% (currently ${occ}%).`,
      expectedOutcomeAr: `تنفيذ زيادة السعر مع استمرار نسبة الإشغال أعلى من 85% (حالياً ${occ}%).`,
      department: 'REVENUE_MANAGEMENT',
      severity: null,
      // Fixed constant, not a formula — same-day rate-change action, no
      // investment required, matches the Opportunity Matrix's "Quick Win"
      // bucket definition. Revisit only when a second opportunity rule
      // exists to compare against.
      opportunityValue: 'QUICK_WIN',
      decisionWindow: 'HOURS_72',
    });
  }

  if (openBalance) {
    const ratio = totalRevenue?.value ? openBalance.value! / totalRevenue.value : null;
    const isHigh = ratio !== null ? ratio > 0.3 : openBalance.value! > 20000;
    if (isHigh) {
      alerts.push({
        severity: 'warning',
        category: 'finance',
        messageEn: `Open balance is ${ratio !== null ? `${Math.round(ratio * 100)}% of total revenue` : `${round(openBalance.value!, 2)}`}.`,
        messageAr: `الرصيد المفتوح ${ratio !== null ? `يمثل ${Math.round(ratio * 100)}% من إجمالي الإيرادات` : `${round(openBalance.value!, 2)}`}.`,
        relatedMetricKey: 'open_balance',
        department: 'FINANCE',
      });
      const openBalanceMagnitude =
        ratio !== null ? magnitudeRatio(ratio - 0.3, 0.3) : magnitudeRatio(openBalance.value! - 20000, 20000);
      recommendations.push({
        priority: 2,
        textEn: `Open balance is elevated${ratio !== null ? ` (${Math.round(ratio * 100)}% of total revenue)` : ''}.`,
        textAr: `الرصيد المفتوح مرتفع${ratio !== null ? ` (${Math.round(ratio * 100)}% من إجمالي الإيرادات)` : ''}.`,
        suggestedActionEn: 'Review outstanding folios and follow up on collections.',
        suggestedActionAr: 'راجع الفواتير المستحقة وتابع عمليات التحصيل.',
        confidence: 1,
        category: 'risk',
        supportingMetrics: supporting(openBalance, totalRevenue),
        owner: 'FRONT_OFFICE_MANAGER',
        timeframe: 'Within 3 days',
        expectedOutcomeEn:
          ratio !== null
            ? `Open balance reduced below 30% of total revenue (currently ${Math.round(ratio * 100)}%).`
            : `Open balance reduced below 20,000 (currently ${round(openBalance.value!, 2)}).`,
        expectedOutcomeAr:
          ratio !== null
            ? `خفض الرصيد المفتوح إلى أقل من 30% من إجمالي الإيرادات (حالياً ${Math.round(ratio * 100)}%).`
            : `خفض الرصيد المفتوح إلى أقل من 20,000 (حالياً ${round(openBalance.value!, 2)}).`,
        // Collections is a finance function even though front-office staff
        // often execute the follow-up (owner above) — department tracks
        // accountability, not who dials the phone.
        department: 'FINANCE',
        severity: classifySeverity(2, openBalanceMagnitude),
        opportunityValue: null,
        decisionWindow: 'HOURS_72',
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
      // A data-integrity flag, not a hotel function's job — no department applies.
      department: null,
    });
  }

  // No-show / cancellation rate spike (Analytics fix, Phase 3) — both
  // measured against arrivals, the closest available proxy for expected
  // bookings; thresholds are conservative hospitality-industry norms, not
  // hotel-specific tuning (no historical baseline to calibrate against yet).
  if (arrivals && arrivals.value! > 0) {
    if (noShows) {
      const rate = noShows.value! / arrivals.value!;
      if (rate > 0.1) {
        const pct = round(rate * 100, 1);
        recommendations.push({
          priority: 2,
          textEn: `No-shows are ${pct}% of arrivals today (${noShows.value} of ${arrivals.value}).`,
          textAr: `عدم الحضور يمثل ${pct}% من الوافدين اليوم (${noShows.value} من ${arrivals.value}).`,
          suggestedActionEn: 'Review no-show/deposit policy and confirm high-risk reservations ahead of arrival.',
          suggestedActionAr: 'راجع سياسة عدم الحضور والودائع، وأكّد الحجوزات عالية المخاطر قبل موعد الوصول.',
          confidence: 1,
          category: 'risk',
          supportingMetrics: supporting(noShows, arrivals),
          owner: 'FRONT_OFFICE_MANAGER',
          timeframe: 'Within 7 days',
          expectedOutcomeEn: `No-show rate reduced below 10% of arrivals (currently ${pct}%).`,
          expectedOutcomeAr: `خفض معدل عدم الحضور إلى أقل من 10% من الوافدين (حالياً ${pct}%).`,
          department: 'FRONT_OFFICE',
          severity: classifySeverity(2, magnitudeRatio(rate - 0.1, 0.1)),
          opportunityValue: null,
          decisionWindow: 'WEEK',
        });
      }
    }
    if (cancellations) {
      const rate = cancellations.value! / arrivals.value!;
      if (rate > 0.15) {
        const pct = round(rate * 100, 1);
        recommendations.push({
          priority: 2,
          textEn: `Cancellations are ${pct}% of arrivals today (${cancellations.value} of ${arrivals.value}).`,
          textAr: `الإلغاءات تمثل ${pct}% من الوافدين اليوم (${cancellations.value} من ${arrivals.value}).`,
          suggestedActionEn: 'Review cancellation policy and recent booking channels for a pattern.',
          suggestedActionAr: 'راجع سياسة الإلغاء وقنوات الحجز الأخيرة لتحديد أي نمط متكرر.',
          confidence: 1,
          category: 'risk',
          supportingMetrics: supporting(cancellations, arrivals),
          owner: 'FRONT_OFFICE_MANAGER',
          timeframe: 'Within 7 days',
          expectedOutcomeEn: `Cancellation rate reduced below 15% of arrivals (currently ${pct}%).`,
          expectedOutcomeAr: `خفض معدل الإلغاء إلى أقل من 15% من الوافدين (حالياً ${pct}%).`,
          department: 'FRONT_OFFICE',
          severity: classifySeverity(2, magnitudeRatio(rate - 0.15, 0.15)),
          opportunityValue: null,
          decisionWindow: 'WEEK',
        });
      }
    }
  }

  // Complimentary / house-use room ratio (Analytics fix, Phase 3) — a
  // common revenue-leakage signal when comp'd rooms exceed a normal
  // allowance relative to total inventory.
  if (roomsAvailable && roomsAvailable.value! > 0 && (complimentaryRooms || houseUseRooms)) {
    const compTotal = (complimentaryRooms?.value ?? 0) + (houseUseRooms?.value ?? 0);
    const ratio = compTotal / roomsAvailable.value!;
    if (ratio > 0.05) {
      const pct = round(ratio * 100, 1);
      recommendations.push({
        priority: 3,
        textEn: `Complimentary and house-use rooms are ${pct}% of available inventory (${compTotal} of ${roomsAvailable.value}).`,
        textAr: `غرف المجاملة والاستخدام الداخلي تمثل ${pct}% من الغرف المتاحة (${compTotal} من ${roomsAvailable.value}).`,
        suggestedActionEn: 'Review comp/house-use approvals for the period against policy.',
        suggestedActionAr: 'راجع موافقات غرف المجاملة والاستخدام الداخلي للفترة مقابل السياسة المعتمدة.',
        confidence: 1,
        category: 'risk',
        supportingMetrics: supporting(complimentaryRooms, houseUseRooms, roomsAvailable),
        owner: 'GENERAL_MANAGER',
        timeframe: 'Within 14 days',
        expectedOutcomeEn: `Complimentary and house-use rooms reduced below 5% of available inventory (currently ${pct}%).`,
        expectedOutcomeAr: `خفض غرف المجاملة والاستخدام الداخلي إلى أقل من 5% من الغرف المتاحة (حالياً ${pct}%).`,
        department: 'GENERAL_MANAGER',
        severity: classifySeverity(3, magnitudeRatio(ratio - 0.05, 0.05)),
        opportunityValue: null,
        decisionWindow: 'MONTH',
      });
    }
  }

  // Out-of-order / out-of-inventory ratio (Analytics fix, Phase 3) — a
  // large share of unavailable inventory both caps achievable occupancy
  // and is itself an actionable maintenance/ops signal.
  if (roomsAvailable && roomsAvailable.value! > 0 && (outOfOrderRooms || outOfInventoryRooms)) {
    const downTotal = (outOfOrderRooms?.value ?? 0) + (outOfInventoryRooms?.value ?? 0);
    const ratio = downTotal / roomsAvailable.value!;
    if (ratio > 0.1) {
      const pct = round(ratio * 100, 1);
      recommendations.push({
        priority: 2,
        textEn: `${pct}% of inventory is out of order or out of service (${downTotal} of ${roomsAvailable.value} rooms).`,
        textAr: `${pct}% من الغرف خارج الخدمة أو خارج المخزون (${downTotal} من ${roomsAvailable.value} غرفة).`,
        suggestedActionEn: 'Review maintenance backlog and prioritize returning rooms to sellable inventory.',
        suggestedActionAr: 'راجع قائمة أعمال الصيانة وأعطِ الأولوية لإعادة الغرف إلى المخزون القابل للبيع.',
        confidence: 1,
        category: 'action',
        supportingMetrics: supporting(outOfOrderRooms, outOfInventoryRooms, roomsAvailable),
        owner: 'GENERAL_MANAGER',
        timeframe: 'Within 14 days',
        expectedOutcomeEn: `Out-of-order/out-of-inventory rooms reduced below 10% of available inventory (currently ${pct}%).`,
        expectedOutcomeAr: `خفض الغرف خارج الخدمة/خارج المخزون إلى أقل من 10% من الغرف المتاحة (حالياً ${pct}%).`,
        // Maintenance is the department that returns rooms to sellable
        // inventory — owner stays GENERAL_MANAGER (accountable for
        // follow-through). category:'action', not risk/opportunity, so no
        // severity/opportunityValue classification applies.
        department: 'MAINTENANCE',
        severity: null,
        opportunityValue: null,
        decisionWindow: 'MONTH',
      });
    }
  }

  return { alerts, recommendations };
}
