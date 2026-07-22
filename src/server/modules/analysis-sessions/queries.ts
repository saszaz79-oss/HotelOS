import { cache } from 'react';
import type { ReportType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { REQUIRED_SESSION_REPORT_TYPES } from './types';

const OPEN_STATUSES = ['collecting', 'analyzing'] as const;

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

/** Read-only status poll for the Executive Analysis progress UI (Phase 2). */
export const getAnalysisSessionStatus = cache(async (hotelId: string, sessionId: string) => {
  return prisma.analysisSession.findFirst({
    where: { id: sessionId, hotelId },
    select: { id: true, status: true, currentStage: true, errorMessage: true, completedAt: true },
  });
});

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
