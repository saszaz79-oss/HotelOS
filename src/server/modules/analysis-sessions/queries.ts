import { cache } from 'react';
import type { ReportType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { REQUIRED_SESSION_REPORT_TYPES } from './types';

// `stalled` counts as "open" (Zero-Lag Sprint) — a session stuck waiting for
// the user to Resume/Retry is still the hotel's one in-progress session, not
// something a fresh Upload-page load should silently ignore and let a new
// session get created on top of.
const OPEN_STATUSES = ['collecting', 'analyzing', 'stalled'] as const;

/** No progress signal for this long while `analyzing` means the background job is presumed dead, not just slow (Zero-Lag Sprint, Incident #1). */
const STALL_THRESHOLD_MS = 60_000;

export interface SessionSlot {
  reportType: ReportType;
  filled: boolean;
  filename: string | null;
  uploadStatus: string | null;
}

/**
 * The hotel's current in-progress Analysis Session, if any (EDI Phase 1) —
 * one open session per hotel at a time. Includes each tagged upload's
 * documents so the Upload page can render the 4 required-report slot cards
 * without a second round trip.
 */
export const getOpenAnalysisSession = cache(async (hotelId: string) => {
  return prisma.analysisSession.findFirst({
    where: { hotelId, status: { in: [...OPEN_STATUSES] } },
    orderBy: { createdAt: 'desc' },
    include: {
      uploads: {
        select: {
          id: true,
          originalFilename: true,
          status: true,
          createdAt: true,
          documents: {
            select: { id: true, reportType: true, extractionConfidence: true, validationStatus: true, completenessScore: true },
          },
        },
      },
    },
  });
});

/**
 * Read-only status poll for the Executive Analysis progress UI (Phase 2).
 * Deliberately NOT `cache()`-wrapped (unlike most reads in this file) —
 * checkAndMarkStalled below needs a real, uncached read-then-conditionally-
 * write on every single poll, and a request-scoped memo here would let a
 * stale pre-stall read win a race against the write.
 */
export async function getAnalysisSessionStatus(hotelId: string, sessionId: string) {
  await checkAndMarkStalled(hotelId, sessionId);
  return prisma.analysisSession.findFirst({
    where: { id: sessionId, hotelId },
    select: { id: true, status: true, currentStage: true, errorMessage: true, errorCode: true, attemptCount: true, completedAt: true },
  });
}

/**
 * Durable stall detection (Zero-Lag Sprint, Incident #1) — there is no
 * background cron/scheduler in this architecture, so staleness can only be
 * detected lazily, at the moment something actually asks for the session's
 * status. This runs on every poll (every ~2s while a session is
 * `analyzing`), so a stall is caught within one poll interval of crossing
 * the threshold, not after some separate out-of-band job gets around to it.
 * Falls back to `startedAt` when `heartbeatAt` is still null (or from a
 * prior attempt) so a crash before the pipeline ever calls
 * updateAnalysisSessionStage is still caught, not silently ignored.
 */
async function checkAndMarkStalled(hotelId: string, sessionId: string): Promise<void> {
  const session = await prisma.analysisSession.findFirst({
    where: { id: sessionId, hotelId },
    select: { status: true, heartbeatAt: true, startedAt: true },
  });
  if (!session || session.status !== 'analyzing') return;

  const referenceTime = session.heartbeatAt ?? session.startedAt;
  if (!referenceTime) return;

  const staleSinceMs = Date.now() - referenceTime.getTime();
  if (staleSinceMs <= STALL_THRESHOLD_MS) return;

  await prisma.analysisSession.update({
    where: { id: sessionId },
    data: {
      status: 'stalled',
      currentStage: 'stalled',
      errorCode: 'HEARTBEAT_TIMEOUT',
      errorMessage: `No progress reported for over ${Math.round(staleSinceMs / 1000)}s — the background process likely crashed or was stopped by the platform before finishing. You can resume from where it left off.`,
    },
  });
}

/**
 * The 4 required-report slot states for the Upload page's cards (EDI Phase
 * 2) — deliberately NOT `cache()`-wrapped: the client polls this
 * repeatedly across separate requests while uploads are still processing,
 * so a request-scoped memo would just return stale data on every poll.
 */
export async function getSessionSlots(hotelId: string, sessionId: string): Promise<SessionSlot[]> {
  const session = await prisma.analysisSession.findFirst({
    where: { id: sessionId, hotelId },
    include: {
      uploads: {
        select: {
          originalFilename: true,
          status: true,
          createdAt: true,
          documents: { select: { reportType: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return REQUIRED_SESSION_REPORT_TYPES.map((reportType) => {
    const match = session?.uploads.find((u) => u.documents.some((d) => d.reportType === reportType));
    return {
      reportType,
      filled: !!match,
      filename: match?.originalFilename ?? null,
      uploadStatus: match?.status ?? null,
    };
  });
}
