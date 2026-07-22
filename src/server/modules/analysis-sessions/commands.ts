import { prisma } from '@/lib/prisma';
import type { AnalysisSessionStage } from '@prisma/client';
import { getOpenAnalysisSession } from './queries';

/**
 * Returns the hotel's current open Analysis Session, creating one if none
 * exists (EDI Phase 1) — this is what the Upload page calls on load, so a
 * hotel always has exactly one in-progress session to attach uploads to.
 * `businessDate` is a workflow label only (which day's work this session
 * represents), not the join key metrics use — `HotelMetric`/`Insight`
 * still key off each report's own confirmed date, independent of this.
 */
export async function createOrGetOpenAnalysisSession(hotelId: string, userId: string) {
  const existing = await getOpenAnalysisSession(hotelId);
  if (existing) return existing;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const created = await prisma.analysisSession.create({
    data: { hotelId, businessDate: today, createdByUserId: userId },
  });
  return { ...created, uploads: [] };
}

/**
 * Advances the session's visible pipeline stage AND refreshes its heartbeat
 * (Zero-Lag Sprint, Incident #1) — every stage transition is both a real
 * completed unit of work (Constitution truth test applied to progress UI,
 * never a timer) and the only real "still alive" signal the durable state
 * machine has. If this stops being called for more than 60s while status is
 * still `analyzing`, the next poll (queries.ts's checkAndMarkStalled) flips
 * the session to `stalled` rather than leaving it silently stuck forever.
 */
export async function updateAnalysisSessionStage(sessionId: string, stage: AnalysisSessionStage): Promise<void> {
  await prisma.analysisSession.update({ where: { id: sessionId }, data: { currentStage: stage, heartbeatAt: new Date() } });
}

/**
 * Starts (or restarts, on Resume/Retry) a processing attempt. `attemptCount`
 * increments every time — a session's real retry history is visible, not
 * just its current state. `startedAt`/`heartbeatAt` are both stamped now, so
 * a crash before the background job ever calls updateAnalysisSessionStage
 * still has a real reference point for staleness (checkAndMarkStalled falls
 * back to `startedAt` when `heartbeatAt` is still from a previous attempt or
 * absent). Clears any previous error so a retried session doesn't show a
 * stale failure reason while it's actively working again.
 */
export async function markAnalysisSessionAnalyzing(sessionId: string): Promise<void> {
  const now = new Date();
  await prisma.analysisSession.update({
    where: { id: sessionId },
    data: {
      status: 'analyzing',
      currentStage: 'queued',
      startedAt: now,
      heartbeatAt: now,
      attemptCount: { increment: 1 },
      errorCode: null,
      errorMessage: null,
    },
  });
}

export async function markAnalysisSessionReady(sessionId: string): Promise<void> {
  await prisma.analysisSession.update({
    where: { id: sessionId },
    data: { status: 'ready', currentStage: 'completed', completedAt: new Date(), heartbeatAt: new Date() },
  });
}

/**
 * `errorCode` is a short, stable, machine-readable reason distinct from
 * `errorMessage`'s human-readable text — defaults to a generic pipeline
 * failure but callers with a more specific real cause (e.g. a provider
 * timeout) should pass it explicitly.
 */
export async function markAnalysisSessionError(sessionId: string, errorMessage: string, errorCode = 'PIPELINE_ERROR'): Promise<void> {
  await prisma.analysisSession.update({
    where: { id: sessionId },
    data: { status: 'error', currentStage: 'failed', errorMessage, errorCode, heartbeatAt: new Date() },
  });
}
