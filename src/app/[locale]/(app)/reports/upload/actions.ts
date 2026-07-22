'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { resolveHotelScope, getActiveMembership } from '@/server/modules/hotels/access';
import { uploadReport, type UploadReportResult } from '@/server/modules/reports/commands';
import { normalizeReportDocument } from '@/server/modules/metrics/commands';
import { getOrRefreshExecutiveSummary } from '@/server/modules/ai-orchestration/commands';
import { getAnalysisSessionStatus, getSessionSlots, type SessionSlot } from '@/server/modules/analysis-sessions/queries';
import {
  markAnalysisSessionAnalyzing,
  markAnalysisSessionReady,
  markAnalysisSessionError,
  updateAnalysisSessionStage,
} from '@/server/modules/analysis-sessions/commands';
import { REQUIRED_SESSION_REPORT_TYPES } from '@/server/modules/analysis-sessions/types';
import { prisma } from '@/lib/prisma';
import type { ReportUploadStatus } from '@prisma/client';
import type { Locale } from '@/i18n/config';
// Side-effect import: registers the extraction pipeline as a subscriber to
// `ReportUploaded` (Architecture §17) — see report-extraction/index.ts.
import '@/server/modules/report-extraction';
// Side-effect import: registers the insights recomputation subscriber on
// `MetricsExtracted` — fires as a side effect of normalizeReportDocument()
// inside startExecutiveAnalysisAction below.
import '@/server/modules/insights';

/**
 * One file per call — the upload UI drives its own per-file queue
 * (progress/retry/removal client-side) rather than submitting one big
 * batch, so a single failed file never blocks or has to be redone
 * alongside files that already succeeded. `analysisSessionId` tags the
 * upload to the hotel's current session (EDI Phase 2) — see
 * `analysis-sessions/commands.ts`'s `createOrGetOpenAnalysisSession`.
 */
export async function uploadSingleReportAction(
  locale: Locale,
  hotelId: string,
  analysisSessionId: string,
  formData: FormData
): Promise<UploadReportResult> {
  const user = await getCurrentUser();
  // Session can expire between page load and submit — redirect to sign in
  // again instead of an uncaught throw (same crash class as digest
  // 881976446/1047464761).
  if (!user) {
    redirect(`/${locale}/login`);
  }
  const scope = await resolveHotelScope(user);

  // Membership/hotel state can change between page load and submit (e.g.
  // the Platform Owner suspends the hotel or revokes membership mid-
  // session) — uploadReport()'s own assertHotelAccess() throws in that
  // case, which must never reach the caller uncaught (same discipline as
  // the login-expiry check above).
  if (scope.kind !== 'super_admin' && !scope.hotelIds.includes(hotelId)) {
    redirect(`/${locale}/mission-control`);
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'EMPTY_FILE' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadReport({
    hotelId,
    uploadedByUserId: user.id,
    scope,
    originalFilename: file.name,
    mimeType: file.type,
    data: buffer,
    analysisSessionId,
  });

  revalidatePath(`/${locale}/reports/upload`);
  return result;
}

export type StartAnalysisResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_STARTED' | 'MISSING_REQUIRED_REPORTS' | 'REPORTS_STILL_PROCESSING' };

/**
 * The "🧠 Start Executive Analysis" action (EDI Phase 2) — validates all 4
 * required report types are present and fully extracted, then runs the
 * rest of the pipeline (auto-finalize → consistency/KPI/score, both driven
 * by the existing MetricsExtracted event chain — see
 * metrics/commands.ts's normalizeReportDocument → insights/index.ts's
 * subscriber → recomputeInsight — → cached Executive Summary) inside
 * `after()`, reusing the Perf Phase 1 background-execution pattern. Every
 * `AnalysisSessionStage` transition below corresponds to a real completed
 * step, not a timer.
 */
export async function startExecutiveAnalysisAction(locale: Locale, hotelId: string, sessionId: string): Promise<StartAnalysisResult> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const scope = await resolveHotelScope(user);
  if (scope.kind !== 'super_admin' && !scope.hotelIds.includes(hotelId)) {
    redirect(`/${locale}/mission-control`);
  }

  const session = await prisma.analysisSession.findFirst({
    where: { id: sessionId, hotelId },
    include: { uploads: { include: { documents: true } } },
  });
  if (!session) return { ok: false, reason: 'NOT_FOUND' };
  // 'error' is retry-friendly — a failed run can be re-attempted directly
  // rather than forcing a whole new session; 'analyzing'/'ready' cannot
  // (already running or already done).
  if (session.status !== 'collecting' && session.status !== 'error') {
    return { ok: false, reason: 'ALREADY_STARTED' };
  }

  // Server-side re-check of the same gate the Upload page's UI already
  // shows — the client-side "all 4 filled" state is UX only.
  const documentsByType = new Map<string, { id: string; uploadStatus: string }>();
  for (const upload of session.uploads) {
    for (const doc of upload.documents) {
      if (!documentsByType.has(doc.reportType)) {
        documentsByType.set(doc.reportType, { id: doc.id, uploadStatus: upload.status });
      }
    }
  }
  const missing = REQUIRED_SESSION_REPORT_TYPES.filter((t) => !documentsByType.has(t));
  if (missing.length > 0) return { ok: false, reason: 'MISSING_REQUIRED_REPORTS' };

  const stillProcessing = REQUIRED_SESSION_REPORT_TYPES.some((t) => {
    const status = documentsByType.get(t)!.uploadStatus;
    return status === 'uploaded' || status === 'processing';
  });
  if (stillProcessing) return { ok: false, reason: 'REPORTS_STILL_PROCESSING' };

  const documentIds = REQUIRED_SESSION_REPORT_TYPES.map((t) => documentsByType.get(t)!.id);
  const membership = await getActiveMembership(user.id);
  const hotelName = membership?.hotel.name ?? '';

  await markAnalysisSessionAnalyzing(sessionId);

  after(async () => {
    try {
      await updateAnalysisSessionStage(sessionId, 'normalizing');
      for (const documentId of documentIds) {
        // Safe to call even for a zero-field (type-detection-only) document
        // — normalizeReportDocument writes zero HotelMetric rows and still
        // marks it confirmed/complete, honestly reflecting no structured
        // data was available (see metrics/commands.ts).
        await normalizeReportDocument(hotelId, documentId, session.businessDate, user.id);
      }

      // Consistency/KPI/health-score all happen as a side effect of each
      // normalizeReportDocument() call above (MetricsExtracted -> the
      // insights subscriber's recomputeInsight, already covers all three) —
      // this stage marks that work as confirmed complete, not separate work.
      await updateAnalysisSessionStage(sessionId, 'consistency');

      await updateAnalysisSessionStage(sessionId, 'executive_intelligence');
      await getOrRefreshExecutiveSummary(hotelId, locale, hotelName, undefined);

      await updateAnalysisSessionStage(sessionId, 'report');
      await markAnalysisSessionReady(sessionId);
    } catch (err) {
      console.error('[reports.upload.startExecutiveAnalysisAction] pipeline failed', { hotelId, sessionId, error: err });
      await markAnalysisSessionError(sessionId, err instanceof Error ? err.message : String(err));
    }
  });

  return { ok: true };
}

/** Read-only status poll for the Executive Analysis progress UI (EDI Phase 2). */
export async function getAnalysisSessionStatusAction(hotelId: string, sessionId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const scope = await resolveHotelScope(user);
  if (scope.kind !== 'super_admin' && !scope.hotelIds.includes(hotelId)) return null;

  return getAnalysisSessionStatus(hotelId, sessionId);
}

/** Read-only poll for the 4 required-report slot cards (EDI Phase 2). */
export async function getSessionSlotsAction(hotelId: string, sessionId: string): Promise<SessionSlot[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const scope = await resolveHotelScope(user);
  if (scope.kind !== 'super_admin' && !scope.hotelIds.includes(hotelId)) return [];

  return getSessionSlots(hotelId, sessionId);
}

export interface UploadStatusResult {
  status: ReportUploadStatus | null;
  errorMessage: string | null;
}

/**
 * Read-only status poll for the upload queue UI — lets the client reflect
 * the async extraction pipeline's real progress (uploaded -> processing ->
 * needs_review/complete/error, now genuinely run in the background via
 * `after()` — see report-extraction/index.ts) instead of freezing at
 * "uploaded" the moment the request returns. Also surfaces the real
 * `ExtractionJob.errorMessage` on failure (Perf fix, Phase 1A) instead of
 * just a generic "processing failed" label, so a user deciding whether to
 * retry has something to go on.
 */
export async function getUploadStatusAction(hotelId: string, reportUploadId: string): Promise<UploadStatusResult> {
  const user = await getCurrentUser();
  if (!user) return { status: null, errorMessage: null };
  const scope = await resolveHotelScope(user);
  if (scope.kind !== 'super_admin' && !scope.hotelIds.includes(hotelId)) return { status: null, errorMessage: null };

  const upload = await prisma.reportUpload.findFirst({
    where: { id: reportUploadId, hotelId },
    select: {
      status: true,
      documents: { take: 1, select: { extractionJobs: { orderBy: { startedAt: 'desc' }, take: 1, select: { errorMessage: true } } } },
    },
  });
  return { status: upload?.status ?? null, errorMessage: upload?.documents[0]?.extractionJobs[0]?.errorMessage ?? null };
}
