import { prisma } from '@/lib/prisma';
import type { Prisma, TimelineEventType } from '@prisma/client';

interface PublishInput {
  hotelId: string;
  eventType: TimelineEventType;
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue;
  sourceRef?: string | null;
}

/**
 * Single publish point for the Hotel Timeline (Architecture §14). Modules
 * call this at the point of the state change rather than a separate process
 * inferring history after the fact, so the timeline never drifts from the
 * events it describes.
 */
export async function publishTimelineEvent({
  hotelId,
  eventType,
  actorUserId = null,
  payload = {},
  sourceRef = null,
}: PublishInput) {
  await prisma.timelineEvent.create({
    data: { hotelId, eventType, actorUserId, payload, sourceRef },
  });
}

export async function listTimelineEvents(hotelId: string, take = 50, cursor?: string) {
  return prisma.timelineEvent.findMany({
    where: { hotelId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { actor: { select: { displayName: true } } },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}
