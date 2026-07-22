import type { RiskSeverity } from '@prisma/client';

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
