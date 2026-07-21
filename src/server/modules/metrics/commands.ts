import { prisma } from '@/lib/prisma';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { publish } from '@/server/modules/events/bus';
import { audit } from '@/server/modules/audit';
import { notifyUser } from '@/server/modules/notifications/commands';
import type { ExtractedField } from '@/server/modules/report-extraction/types';

export type CorrectHotelMetricResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' };

/**
 * Post-finalize KPI correction (Analytics fix, Phase 4) — distinct from
 * `updateExtractedField` (report-extraction/review-commands.ts), which
 * edits a ReportDocument's candidate fields *before* finalize. This edits
 * an already-finalized HotelMetric row directly, for the case where a
 * consistency check flags a mismatch after the fact. User-submitted and
 * reason-required only — this function is never called by the rule
 * engine itself (Constitution truth test: flag a discrepancy, never
 * silently "fix" it). Reuses the existing `isManuallyCorrected`/
 * `correctedByUserId` fields (already on HotelMetric, previously only
 * written by normalizeReportDocument) and the existing AuditLog model —
 * no schema change.
 */
export async function correctHotelMetric(
  hotelId: string,
  metricDate: Date,
  metricKey: string,
  newValue: number,
  userId: string,
  reason: string
): Promise<CorrectHotelMetricResult> {
  const existing = await prisma.hotelMetric.findUnique({
    where: { hotelId_metricDate_metricKey: { hotelId, metricDate, metricKey } },
  });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };

  const previousValue = existing.value;

  await prisma.hotelMetric.update({
    where: { hotelId_metricDate_metricKey: { hotelId, metricDate, metricKey } },
    data: { value: newValue, isManuallyCorrected: true, correctedByUserId: userId },
  });

  // Re-derive Health Score/Alerts/Recommendations from the corrected value
  // via the same event-driven path normalizeReportDocument uses — a
  // correction that doesn't propagate to derived insights would leave
  // them silently stale against the number the user just fixed.
  if (existing.sourceReportDocumentId) {
    await publish({
      type: 'MetricsExtracted',
      hotelId,
      payload: { metricDate: metricDate.toISOString(), reportDocumentId: existing.sourceReportDocumentId },
      causationRef: existing.sourceReportDocumentId,
    });
  }

  await publishTimelineEvent({
    hotelId,
    eventType: 'metric_corrected',
    actorUserId: userId,
    payload: { stage: 'post_finalize', metricKey, metricDate: metricDate.toISOString(), previousValue, newValue, reason },
    sourceRef: existing.sourceReportDocumentId,
  });

  await audit({
    hotelId,
    userId,
    action: 'metric.manual_correction',
    metadata: { metricKey, metricDate: metricDate.toISOString(), previousValue, newValue, reason },
  });

  return { ok: true };
}

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

  try {
    await notifyUser(userId, hotelId, 'brief_ready', {
      titleEn: 'Morning Brief updated',
      titleAr: 'تم تحديث موجز الصباح',
      bodyEn: `New metrics for ${confirmedReportDate.toLocaleDateString('en')}`,
      bodyAr: `مقاييس جديدة لتاريخ ${confirmedReportDate.toLocaleDateString('ar')}`,
      sourceRef: reportDocumentId,
    });
  } catch (err) {
    console.error('[metrics.normalizeReportDocument] brief_ready notification failed', { hotelId, reportDocumentId, error: err });
  }
}
