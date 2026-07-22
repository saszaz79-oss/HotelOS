import { cache } from 'react';
import { prisma } from '@/lib/prisma';

const OPEN_STATUSES = ['collecting', 'analyzing'] as const;

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
