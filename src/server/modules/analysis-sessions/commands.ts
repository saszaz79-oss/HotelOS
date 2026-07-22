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
 * Advances the session's visible pipeline stage (EDI Phase 2's orchestrator
 * calls this between each real step) — every stage transition corresponds
 * to a real completed unit of work, never a timer (Constitution truth test
 * applied to progress UI, not just report content).
 */
export async function updateAnalysisSessionStage(sessionId: string, stage: AnalysisSessionStage): Promise<void> {
  await prisma.analysisSession.update({ where: { id: sessionId }, data: { currentStage: stage } });
}

export async function markAnalysisSessionAnalyzing(sessionId: string): Promise<void> {
  await prisma.analysisSession.update({ where: { id: sessionId }, data: { status: 'analyzing', currentStage: 'reading' } });
}

export async function markAnalysisSessionReady(sessionId: string): Promise<void> {
  await prisma.analysisSession.update({
    where: { id: sessionId },
    data: { status: 'ready', currentStage: 'complete', completedAt: new Date() },
  });
}

export async function markAnalysisSessionError(sessionId: string, errorMessage: string): Promise<void> {
  await prisma.analysisSession.update({
    where: { id: sessionId },
    data: { status: 'error', currentStage: 'error', errorMessage },
  });
}
