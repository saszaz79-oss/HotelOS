import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { storage } from '@/server/modules/storage';
import { publishTimelineEvent } from '@/server/modules/timeline';
import { notifyUser } from '@/server/modules/notifications/commands';
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
 * normalize/analyze are Roadmap M4+, not run here). Runs in the background
 * via `after()` (Perf fix, Phase 1A) — triggered by the `ReportUploaded`
 * subscriber in index.ts, not awaited by the upload Server Action.
 */
export async function processReportUpload(hotelId: string, reportUploadId: string): Promise<void> {
  const upload = await prisma.reportUpload.findFirst({ where: { id: reportUploadId, hotelId } });
  if (!upload) return;

  // Atomic claim, not an unconditional update: `after()` introduces a real
  // race window a synchronous call never had — a retry (see retryExtractionAction)
  // could fire while an earlier background run for the same upload is still
  // in flight. Only the run that actually flips the status to 'processing'
  // proceeds; a second concurrent attempt sees 0 rows affected and backs off.
  const claimed = await prisma.reportUpload.updateMany({
    where: { id: upload.id, status: { in: ['uploaded', 'error'] } },
    data: { status: 'processing' },
  });
  if (claimed.count === 0) return;

  // Reuse an existing ReportDocument on retry instead of creating a
  // duplicate — a prior failed attempt already left one behind.
  const existingDoc = await prisma.reportDocument.findFirst({ where: { reportUploadId: upload.id } });
  const reportDocumentId = existingDoc?.id ?? crypto.randomUUID();
  let job: { id: string } | undefined;

  try {
    if (!existingDoc) {
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
    }

    // Preserve prior failed attempts as job history (attempt increments)
    // rather than overwriting — a retry is a new ExtractionJob row, not a
    // mutation of the failed one.
    const attemptNumber = (await prisma.extractionJob.count({ where: { reportDocumentId } })) + 1;
    job = await prisma.extractionJob.create({
      data: { reportDocumentId, stage: 'extract', attempt: attemptNumber },
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

    // Never let a notification-write failure downgrade an actually-
    // successful extraction into an 'error' status by escaping into the
    // outer catch below.
    try {
      await notifyUser(upload.uploadedByUserId, hotelId, 'needs_review', {
        titleEn: 'Report ready for review',
        titleAr: 'التقرير جاهز للمراجعة',
        bodyEn: upload.originalFilename,
        bodyAr: upload.originalFilename,
        sourceRef: upload.id,
      });
    } catch (err) {
      console.error('[report-extraction.processReportUpload] needs_review notification failed', { hotelId, reportUploadId, error: err });
    }
  } catch (err) {
    if (job) {
      await prisma.extractionJob.update({
        where: { id: job.id },
        data: { stage: 'error', errorMessage: err instanceof Error ? err.message : String(err), completedAt: new Date() },
      });
    }
    await prisma.reportUpload.update({ where: { id: upload.id }, data: { status: 'error' } });

    try {
      await notifyUser(upload.uploadedByUserId, hotelId, 'upload_failed', {
        titleEn: 'Report processing failed',
        titleAr: 'فشلت معالجة التقرير',
        bodyEn: upload.originalFilename,
        bodyAr: upload.originalFilename,
        sourceRef: upload.id,
      });
    } catch (notifyErr) {
      console.error('[report-extraction.processReportUpload] upload_failed notification failed', { hotelId, reportUploadId, error: notifyErr });
    }
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
