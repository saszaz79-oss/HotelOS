import type { RiskSeverity, OpportunityValue, DecisionWindow, HotelDepartment } from '@prisma/client';

/**
 * Shared classification math (Executive Decision Intelligence redesign) —
 * used by both rules.ts (to classify a fired recommendation for the Risk
 * Matrix) and scoring.ts (to decompose the health score into sub-
 * categories), so the "how far past threshold, normalized" shape every
 * rule's inline ratio math already produces is written once. Everything
 * here classifies or rescales a number the caller already computed from
 * real data — nothing in this file invents a value.
 */

/**
 * `priority` (1-3, an editorial signal already assigned per rule family in
 * rules.ts) is the primary axis; `magnitudeRatio` (how far past its
 * threshold the triggering value is, normalized so 0 = at the threshold,
 * 1 = twice the threshold's distance past it) only breaks the tie within
 * priority 2. This avoids a brittle two-axis matrix where every rule would
 * need its own bespoke severity table.
 */
export function classifySeverity(priority: number, magnitudeRatioValue: number): RiskSeverity {
  if (priority <= 1) return 'CRITICAL';
  if (priority === 2) return magnitudeRatioValue > 0.5 ? 'HIGH' : 'MEDIUM';
  return 'LOW';
}

/** How far a value sits past a threshold, relative to the threshold itself — clamped at 0 so a value that hasn't actually crossed the threshold never produces a negative ratio (callers only invoke this once a rule has already confirmed the threshold is crossed, but this stays defensive rather than assuming that). */
export function magnitudeRatio(distancePastThreshold: number, threshold: number): number {
  if (threshold === 0) return 0;
  return Math.max(0, distancePastThreshold / threshold);
}

/** Inverts a 0..1 "badness" ratio into a 0..maxScore health-factor contribution — shared by scoring.ts's Operational Health sub-score, same rescaling `computeHealthScore`'s existing factors already do inline. */
export function invertRatioToScore(ratio: number, maxScore: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round((1 - clamped) * maxScore * 100) / 100;
}

export type RecurrenceLikelihood = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Risk/Opportunity Matrix "Probability" column (Executive Decision
 * Intelligence redesign, Phase 4) — every rule fires only once its
 * triggering condition is already true on verified data, so "probability
 * this condition exists" is trivially 100% for all of them; a fabricated
 * statistical forecast would misrepresent that as if it were a predictive
 * model. What this returns instead is honestly a fixed, editorial signal —
 * "how likely is this to recur or persist without intervention" — set once
 * per rule family and documented here, the same fixed-constant discipline
 * already used for `timeframe` strings and `opportunityValue`. Keyed by
 * (category, department, priority), which is unique per rule family in the
 * current rule set (insights/rules.ts) — two rules sharing a key are
 * treated as the same risk class deliberately (no-shows vs cancellations:
 * both are day-to-day arrival-behavior variance, not distinguished further).
 */
export function ruleLikelihood(category: string, department: HotelDepartment | null, priority: number): RecurrenceLikelihood {
  if (category === 'risk' && department === 'REVENUE_MANAGEMENT' && priority === 1) return 'HIGH'; // occupancy shortfalls persist without a pricing correction
  if (category === 'opportunity' && department === 'REVENUE_MANAGEMENT') return 'HIGH'; // demand-driven pricing power typically holds through the current booking window
  if (category === 'risk' && department === 'FINANCE') return 'HIGH'; // uncollected balances compound without active follow-up
  if (category === 'risk' && department === 'FRONT_OFFICE') return 'MEDIUM'; // no-show/cancellation rates fluctuate day-to-day, often a fixable policy gap rather than a persistent trend
  if (category === 'risk' && department === 'GENERAL_MANAGER') return 'LOW'; // comp/house-use overages are typically a slow-moving compliance pattern
  if (category === 'action' && department === 'MAINTENANCE') return 'MEDIUM'; // maintenance backlogs persist without intervention but rarely worsen sharply day-to-day
  return 'MEDIUM'; // no rule family match (future rule not yet classified here) — a neutral default, never a guessed extreme
}

const LIKELIHOOD_RANK: Record<RecurrenceLikelihood, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_RANK: Record<RiskSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const OPPORTUNITY_RANK: Record<OpportunityValue, number> = { QUICK_WIN: 3, HIGH_ROI: 3, LONG_TERM: 1 };
const DECISION_WINDOW_RANK: Record<DecisionWindow, number> = { IMMEDIATE: 4, HOURS_72: 3, WEEK: 2, MONTH: 1 };

/**
 * "Sort by priority automatically" for the Risk Matrix / Opportunity Matrix
 * (Executive Decision Intelligence redesign, Phase 4) — a single explainable
 * composite score, not a black box. Decision window (how soon someone must
 * start acting) dominates the ranking since that is the single most
 * executive-relevant axis of the three; severity/opportunity value is the
 * secondary axis; recurrence likelihood only breaks remaining ties. Higher
 * score sorts first (most urgent/impactful at the top).
 */
export function matrixRank(input: {
  decisionWindow: DecisionWindow | null;
  severity: RiskSeverity | null;
  opportunityValue: OpportunityValue | null;
  likelihood: RecurrenceLikelihood;
}): number {
  const windowScore = input.decisionWindow ? DECISION_WINDOW_RANK[input.decisionWindow] : 0;
  const impactScore = input.severity ? SEVERITY_RANK[input.severity] : input.opportunityValue ? OPPORTUNITY_RANK[input.opportunityValue] : 0;
  const likelihoodScore = LIKELIHOOD_RANK[input.likelihood];
  return windowScore * 100 + impactScore * 10 + likelihoodScore;
}

/**
 * Executive Decision Box "kind" (Executive Decision Intelligence redesign,
 * Phase 4) — a closed, small vocabulary of card types, chosen deterministically
 * from fields the rule engine already set. Only kinds a real, currently-firing
 * rule can actually produce are ever returned — "Forecast Alert" and
 * "Financial Opportunity" (both plausible future rule families) are
 * deliberately absent from this mapping today rather than force-matched to
 * an unrelated rule, since no rule produces that signal yet.
 */
export type DecisionBoxKind = 'immediate_attention' | 'collection_risk' | 'pricing_recommendation' | 'guest_experience_alert' | 'operational_warning' | 'revenue_opportunity';

export function decisionBoxKind(r: { category: string; department: HotelDepartment | null; severity: RiskSeverity | null }): DecisionBoxKind {
  if (r.category === 'risk') {
    if (r.severity === 'CRITICAL') return 'immediate_attention';
    if (r.department === 'FINANCE') return 'collection_risk';
    if (r.department === 'FRONT_OFFICE') return 'guest_experience_alert';
    return 'operational_warning';
  }
  if (r.category === 'opportunity') {
    if (r.department === 'REVENUE_MANAGEMENT') return 'pricing_recommendation';
    return 'revenue_opportunity';
  }
  return 'operational_warning'; // category: 'action'
}
