import { prisma } from '@/lib/prisma';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { publish } from '@/server/modules/events/bus';
import { audit } from '@/server/modules/audit';
import type { ExtractedField } from '@/server/modules/report-extraction/types';

/**
 * Normalization (Roadmap M4, Architecture §3 data flow step 3): the only
 * place reviewed candidate values become authoritative `HotelMetric` rows.
 * Nothing upstream (extraction, review) writes HotelMetric directly — this
 * is the CQRS command boundary (Architecture §28) for the Metrics context.
 */
export async function normalizeReportDocument(
  hotelId: string,
  reportDocumentId: string,
  confirmedReportDate: Date,
  userId: string
): Promise<void> {
  const doc = await prisma.reportDocument.findFirstOrThrow({ where: { id: reportDocumentId, hotelId } });
  const fields = doc.extractedFields as unknown as ExtractedField[];

  const byKey = new Map(fields.map((f) => [f.metricKey, f]));

  // ADR/RevPAR cross-check (Architecture §5, PRD §5): computed from
  // components takes precedence over a raw extracted value when both are
  // derivable — never trust a raw ADR/RevPAR figure the components disagree with.
  const roomRevenue = byKey.get('room_revenue')?.value ?? null;
  const roomsSold = byKey.get('rooms_sold')?.value ?? null;
  const roomsAvailable = byKey.get('rooms_available')?.value ?? null;

  if (roomRevenue !== null && roomsSold !== null && roomsSold > 0) {
    const computedAdr = roomRevenue / roomsSold;
    const existing = byKey.get('adr');
    byKey.set('adr', {
      metricKey: 'adr',
      labelEn: 'ADR',
      rawText: existing?.rawText ?? null,
      value: computedAdr,
      confidence: 1,
      corrected: false,
      // Computed from components whose own review status this function
      // doesn't re-check — conservatively not claimed "verified" (unused
      // downstream today, kept accurate in case that changes).
      status: 'needs_review',
    });
  }
  if (roomRevenue !== null && roomsAvailable !== null && roomsAvailable > 0) {
    const computedRevpar = roomRevenue / roomsAvailable;
    const existing = byKey.get('revpar');
    byKey.set('revpar', {
      metricKey: 'revpar',
      labelEn: 'RevPAR',
      rawText: existing?.rawText ?? null,
      value: computedRevpar,
      confidence: 1,
      corrected: false,
      status: 'needs_review',
    });
  }

  const writes = Array.from(byKey.values()).filter((f) => f.value !== null);

  await prisma.$transaction(
    writes.map((f) =>
      prisma.hotelMetric.upsert({
        where: { hotelId_metricDate_metricKey: { hotelId, metricDate: confirmedReportDate, metricKey: f.metricKey } },
        update: {
          value: f.value,
          sourceReportDocumentId: reportDocumentId,
          isManuallyCorrected: f.corrected ?? false,
          correctedByUserId: f.corrected ? userId : null,
        },
        create: {
          hotelId,
          metricDate: confirmedReportDate,
          metricKey: f.metricKey,
          value: f.value,
          sourceReportDocumentId: reportDocumentId,
          isManuallyCorrected: f.corrected ?? false,
          correctedByUserId: f.corrected ? userId : null,
        },
      })
    )
  );

  await prisma.reportDocument.update({ where: { id: reportDocumentId }, data: { confirmedReportDate } });
  await prisma.reportUpload.update({ where: { id: doc.reportUploadId }, data: { status: 'complete' } });

  await publishTimelineEvent({
    hotelId,
    eventType: 'report_finalized',
    actorUserId: userId,
    payload: { metricDate: confirmedReportDate.toISOString(), metricsWritten: writes.length },
    sourceRef: reportDocumentId,
  });

  await publish({
    type: 'MetricsExtracted',
    hotelId,
    payload: { metricDate: confirmedReportDate.toISOString(), reportDocumentId },
    causationRef: reportDocumentId,
  });

  await audit({
    hotelId,
    userId,
    action: 'report.finalize',
    metadata: { reportDocumentId, metricDate: confirmedReportDate.toISOString(), metricsWritten: writes.length },
  });
}
