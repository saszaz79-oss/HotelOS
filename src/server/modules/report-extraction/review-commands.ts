import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { publishTimelineEvent } from '@/server/modules/timeline';
import type { ExtractedField } from './types';

/**
 * Manual review corrections (PRD §4 review step) — a command, per CQRS
 * convention (Architecture §28). Split out of commands.ts (which also
 * holds the PDF extraction pipeline) so the report detail page's server
 * actions, which only need this one function, don't pull the `unpdf`
 * parsing dependency into their bundle (Perf sprint, M14) — `unpdf` is
 * only ever needed by the async, event-bus-triggered upload pipeline,
 * never by reviewing/correcting an already-extracted field.
 */
export async function updateExtractedField(
  hotelId: string,
  reportDocumentId: string,
  metricKey: string,
  value: number | null,
  userId: string
): Promise<void> {
  const doc = await prisma.reportDocument.findUniqueOrThrow({ where: { id: reportDocumentId } });
  const fields = (doc.extractedFields as unknown as ExtractedField[]).map((f) =>
    f.metricKey === metricKey
      ? { ...f, value, confidence: 1, corrected: true, ambiguous: false, status: value === null ? 'missing' : ('verified' as const) }
      : f
  );
  await prisma.reportDocument.update({
    where: { id: reportDocumentId },
    data: { extractedFields: fields as unknown as Prisma.InputJsonValue },
  });

  await publishTimelineEvent({
    hotelId,
    eventType: 'metric_corrected',
    actorUserId: userId,
    payload: { metricKey, value },
    sourceRef: reportDocumentId,
  });
}
