import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { storage } from '@/server/modules/storage';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { selectAdapter } from './adapters';
import { assessDataQuality } from './data-quality';
import type { ExtractedField, PdfPage } from './types';

/**
 * The extraction pipeline (Roadmap M3, Architecture §7, §17). Triggered by
 * the `ReportUploaded` domain event (see index.ts) rather than called
 * directly from the `reports` module — the decoupling the Event Bus exists
 * for (Architecture §17).
 *
 * Stages: extract → validate (upload already happened in `reports`;
 * normalize/analyze are Roadmap M4+, not run here). Runs synchronously
 * in-process for v0.1 (Architecture §16: "described as the v0.1 target...
 * even if v0.1 runs it in-process" — the real job queue is a v0.1+ upgrade
 * that doesn't change this function's external shape).
 */
export async function processReportUpload(hotelId: string, reportUploadId: string): Promise<void> {
  const upload = await prisma.reportUpload.findFirst({ where: { id: reportUploadId, hotelId } });
  if (!upload) return;

  await prisma.reportUpload.update({ where: { id: upload.id }, data: { status: 'processing' } });

  const reportDocumentId = crypto.randomUUID();
  let job: { id: string } | undefined;

  try {
    // ExtractionJob.reportDocumentId is a required FK to ReportDocument, so
    // the document row must exist before any ExtractionJob can reference it
    // — a placeholder (reportType is unknown until extraction runs) is
    // created first and updated in place once the real type is known, rather
    // than created fresh at the end. Confirmed in production: every prior
    // report upload left ExtractionJob.create failing with a foreign-key
    // violation here, silently swallowed by the event bus, so status never
    // advanced past "processing".
    await prisma.reportDocument.create({
      data: {
        id: reportDocumentId,
        reportUploadId: upload.id,
        hotelId,
        reportType: 'GENERIC',
        checksumSha256: upload.checksumSha256,
      },
    });

    job = await prisma.extractionJob.create({
      data: { reportDocumentId, stage: 'extract' },
    });

    const fileBuffer = await storage.get(upload.storageKey);
    const { fullText, pages } = await extractPdfContent(fileBuffer);

    const adapter = selectAdapter(fullText);
    const result = adapter.extract(fullText, pages);

    await prisma.extractionJob.update({ where: { id: job.id }, data: { stage: 'validate' } });
    const quality = assessDataQuality(result.fields as ExtractedField[]);

    await prisma.reportDocument.update({
      where: { id: reportDocumentId },
      data: {
        reportType: adapter.reportType,
        detectedReportDate: result.detectedReportDate,
        extractionConfidence: result.typeConfidence,
        rawExtractedText: adapter.reportType === 'GENERIC' ? fullText : null,
        completenessScore: quality.completenessScore,
        validationStatus: quality.validationStatus,
        qualityNotes: quality.qualityNotes as unknown as Prisma.InputJsonValue,
        parserWarnings: result.parserWarnings as unknown as Prisma.InputJsonValue,
        extractedFields: result.fields as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.extractionJob.update({
      where: { id: job.id },
      data: { stage: 'complete', completedAt: new Date() },
    });

    await prisma.reportUpload.update({ where: { id: upload.id }, data: { status: 'needs_review' } });

    await publishTimelineEvent({
      hotelId,
      eventType: 'report_extracted',
      payload: {
        reportType: adapter.reportType,
        completenessScore: quality.completenessScore,
        validationStatus: quality.validationStatus,
      },
      sourceRef: reportDocumentId,
    });
  } catch (err) {
    if (job) {
      await prisma.extractionJob.update({
        where: { id: job.id },
        data: { stage: 'error', errorMessage: err instanceof Error ? err.message : String(err), completedAt: new Date() },
      });
    }
    await prisma.reportUpload.update({ where: { id: upload.id }, data: { status: 'error' } });
  }
}

/**
 * PDF text extraction via `unpdf` (not `pdf-parse`): `pdf-parse`'s bundled
 * output references `node:worker_threads` in both its Node and browser
 * builds, which Cloudflare Workers does not support even with
 * `nodejs_compat` — confirmed by inspecting the installed package's
 * compiled output during Cloudflare deployment prep. `unpdf` ships a
 * "serverless build" of PDF.js specifically documented for Cloudflare
 * Workers (worker inlined into the main bundle, no `worker_threads`).
 */
async function extractPdfContent(buffer: Buffer): Promise<{ fullText: string; pages: PdfPage[] }> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages: PdfPage[] = text.map((pageText, i) => ({ num: i + 1, text: pageText }));
  return { fullText: text.join('\n'), pages };
}

/** Manual review corrections (PRD §4 review step) — a command, per CQRS convention (Architecture §28). */
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
