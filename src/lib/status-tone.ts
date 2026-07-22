import type { HotelDepartment, RiskSeverity, OpportunityValue, DecisionWindow } from '@prisma/client';
import type { DecisionBoxKind } from '@/server/modules/insights/classification';
import type { StatusTone } from '@/components/ui/StatusBadge';

/** Hotel.status → badge tone, shared across every admin screen that lists hotels. */
export function hotelStatusTone(status: string): StatusTone {
  if (status === 'active') return 'positive';
  if (status === 'suspended') return 'warning';
  return 'neutral'; // archived
}

/** User.status → badge tone. */
export function userStatusTone(status: string): StatusTone {
  return status === 'active' ? 'positive' : 'neutral';
}

/** ReportUpload.status → badge tone. */
export function reportStatusTone(status: string): StatusTone {
  if (status === 'complete') return 'positive';
  if (status === 'error') return 'critical';
  if (status === 'needs_review') return 'warning';
  return 'info'; // uploaded, processing
}

/** TimelineEvent.eventType → dot tone, shared by the hotel Timeline page. */
export function timelineEventTone(eventType: string): StatusTone {
  if (eventType === 'report_finalized' || eventType === 'alert_resolved') return 'positive';
  if (eventType === 'alert_raised') return 'critical';
  if (eventType === 'metric_corrected') return 'warning';
  if (eventType === 'report_uploaded' || eventType === 'report_extracted' || eventType === 'ai_summary_generated' || eventType === 'recommendation_issued') return 'info';
  return 'neutral'; // ai_conversation, export_generated, decision_logged
}

/**
 * Insight.healthScore / ExecutiveScoreCategory.score (0-100) → tone
 * (Executive Decision Intelligence redesign) — shared by the Executive
 * Morning Brief's status banner and its 6-way score grid, so both read the
 * same thresholds. Return type is deliberately the 3-value subset shared by
 * both `StatusTone` (StatusBadge) and `KpiTone` (KpiCard) rather than
 * annotated as either — this function feeds both components. Thresholds
 * mirror the existing 0.8/0.5 data-quality split (mission-control's local
 * `dataQualityTone`) rescaled to a 0-100 score.
 */
export function healthScoreTone(score: number): 'positive' | 'warning' | 'critical' {
  if (score >= 70) return 'positive';
  if (score >= 40) return 'warning';
  return 'critical';
}

/** Risk Matrix classification (Recommendation.severity) → tone. */
export function riskSeverityTone(severity: RiskSeverity): StatusTone {
  if (severity === 'CRITICAL') return 'critical';
  if (severity === 'HIGH') return 'warning';
  return 'info'; // MEDIUM, LOW
}

/** Opportunity Matrix classification (Recommendation.opportunityValue) → tone. */
export function opportunityValueTone(value: OpportunityValue): StatusTone {
  if (value === 'QUICK_WIN' || value === 'HIGH_ROI') return 'positive';
  return 'info'; // LONG_TERM
}

/** Decision Timeline bucket (Recommendation.decisionWindow) → tone, urgency-ordered. */
export function decisionWindowTone(window: DecisionWindow): StatusTone {
  if (window === 'IMMEDIATE') return 'critical';
  if (window === 'HOURS_72') return 'warning';
  return 'neutral'; // WEEK, MONTH
}

/**
 * HotelDepartment (Recommendation.department / Alert.department) → tone.
 * Always neutral: department identifies who's accountable, not how urgent
 * something is — color is reserved for severity/opportunity/decision-window
 * signals above. Centralized here so no call site improvises its own
 * department color once Department Intelligence (Phase 4) needs the same
 * badge in more than one place.
 */
export function departmentTone(_department: HotelDepartment): StatusTone {
  return 'neutral';
}

/** Executive Decision Box kind (classification.ts's decisionBoxKind()) → tone. */
export function decisionBoxKindTone(kind: DecisionBoxKind): StatusTone {
  if (kind === 'immediate_attention') return 'critical';
  if (kind === 'collection_risk' || kind === 'guest_experience_alert' || kind === 'operational_warning') return 'warning';
  return 'positive'; // pricing_recommendation, revenue_opportunity
}
