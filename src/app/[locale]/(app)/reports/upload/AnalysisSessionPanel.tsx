'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AnalysisSessionStage, AnalysisSessionStatus, ReportType } from '@prisma/client';
import { UploadForm } from './UploadForm';
import { startExecutiveAnalysisAction, getAnalysisSessionStatusAction, getSessionSlotsAction } from './actions';
import type { SessionSlot } from '@/server/modules/analysis-sessions/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Locale } from '@/i18n/config';

interface UploadDict {
  selectFiles: string;
  submit: string;
  uploading: string;
  success: string;
  errors: Record<string, string>;
  dragDropHint: string;
  browse: string;
  remove: string;
  retry: string;
  clear: string;
  queued: string;
  acceptedTypesHint: string;
  maxSizeHint: string;
  processingUploaded: string;
  processingProcessing: string;
  processingNeedsReview: string;
  processingComplete: string;
  processingFailed: string;
  processingStillWorking: string;
  viewReport: string;
}

interface AnalysisDict {
  requiredReports: string;
  slotEmpty: string;
  slotUploaded: string;
  slotProcessing: string;
  slotValidated: string;
  slotTypeRecognized: string;
  slotUnrecognized: string;
  startAnalysis: string;
  viewReport: string;
  analyzingTitle: string;
  stepReading: string;
  stepExtracting: string;
  stepNormalizing: string;
  stepConsistency: string;
  stepKpi: string;
  stepScore: string;
  stepIntelligence: string;
  stepReport: string;
  stepFinalizing: string;
  errorTitle: string;
  retryAnalysis: string;
  missingReports: string;
  stillProcessing: string;
  notFound: string;
  alreadyStarted: string;
}

const SLOT_POLL_MS = 3000;
const SESSION_POLL_MS = 2000;

// Ordered so a row's index can be compared against the current backend
// stage's index to decide done/in-progress/pending — multiple checklist
// rows can share one real backend stage (see startExecutiveAnalysisAction),
// never a fabricated per-row delay.
const STAGE_ORDER: AnalysisSessionStage[] = ['reading', 'normalizing', 'consistency', 'executive_intelligence', 'report', 'complete'];

function stageIndex(stage: AnalysisSessionStage | null): number {
  if (!stage) return -1;
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? -1 : i;
}

export function AnalysisSessionPanel({
  locale,
  hotelId,
  sessionId,
  initialStatus,
  initialStage,
  initialSlots,
  dict,
  analysisDict,
  reportTypesDict,
}: {
  locale: Locale;
  hotelId: string;
  sessionId: string;
  initialStatus: AnalysisSessionStatus;
  initialStage: AnalysisSessionStage | null;
  initialSlots: SessionSlot[];
  dict: UploadDict;
  analysisDict: AnalysisDict;
  reportTypesDict: Record<string, string>;
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [status, setStatus] = useState(initialStatus);
  const [stage, setStage] = useState(initialStage);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const slotPollTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sessionPollTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const allFilled = slots.every((s) => s.filled);

  const refreshSlots = useCallback(async () => {
    const next = await getSessionSlotsAction(hotelId, sessionId);
    setSlots(next);
  }, [hotelId, sessionId]);

  // Poll slot state while still collecting and something isn't filled yet —
  // stops once all 4 are filled (nothing left to learn) or once analysis starts.
  useEffect(() => {
    if (status !== 'collecting') return;
    if (allFilled) return;
    slotPollTimer.current = setTimeout(refreshSlots, SLOT_POLL_MS);
    return () => clearTimeout(slotPollTimer.current);
  }, [status, allFilled, slots, refreshSlots]);

  // Poll session status/stage while analysis is actually running.
  useEffect(() => {
    if (status !== 'analyzing') return;
    sessionPollTimer.current = setTimeout(async () => {
      const result = await getAnalysisSessionStatusAction(hotelId, sessionId);
      if (!result) return;
      setStatus(result.status);
      setStage(result.currentStage);
      setErrorMessage(result.errorMessage);
    }, SESSION_POLL_MS);
    return () => clearTimeout(sessionPollTimer.current);
  }, [status, stage, hotelId, sessionId]);

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    const result = await startExecutiveAnalysisAction(locale, hotelId, sessionId);
    setStarting(false);
    if (!result.ok) {
      setStartError(analysisDict[result.reason === 'MISSING_REQUIRED_REPORTS' ? 'missingReports' : result.reason === 'REPORTS_STILL_PROCESSING' ? 'stillProcessing' : result.reason === 'NOT_FOUND' ? 'notFound' : 'alreadyStarted']);
      return;
    }
    setStatus('analyzing');
    setStage('reading');
  }

  if (status === 'ready') {
    return (
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-sm text-ink-muted">{analysisDict.analyzingTitle}</p>
        <Link href={`/${locale}/reports/export`}>
          <Button size="lg">{analysisDict.viewReport}</Button>
        </Link>
      </Card>
    );
  }

  if (status === 'analyzing') {
    const idx = stageIndex(stage);
    const rows: { label: string; stage: AnalysisSessionStage }[] = [
      { label: analysisDict.stepReading, stage: 'reading' },
      { label: analysisDict.stepExtracting, stage: 'reading' },
      { label: analysisDict.stepNormalizing, stage: 'normalizing' },
      { label: analysisDict.stepConsistency, stage: 'consistency' },
      { label: analysisDict.stepKpi, stage: 'consistency' },
      { label: analysisDict.stepScore, stage: 'consistency' },
      { label: analysisDict.stepIntelligence, stage: 'executive_intelligence' },
      { label: analysisDict.stepReport, stage: 'report' },
      { label: analysisDict.stepFinalizing, stage: 'report' },
    ];
    return (
      <Card className="space-y-4 py-8">
        <p className="text-center text-sm font-medium text-ink">{analysisDict.analyzingTitle}</p>
        <ul className="mx-auto max-w-xs space-y-2 text-sm">
          {rows.map((row, i) => {
            const rowIdx = stageIndex(row.stage);
            const isDone = rowIdx >= 0 && idx > rowIdx;
            const isCurrent = rowIdx === idx;
            return (
              <li key={i} className="flex items-center gap-2">
                <span className={isDone ? 'text-status-positive' : isCurrent ? 'text-accent' : 'text-ink-muted'}>
                  {isDone ? '✓' : isCurrent ? '⏳' : '·'}
                </span>
                <span className={isDone || isCurrent ? 'text-ink' : 'text-ink-muted'}>{row.label}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }

  // status === 'collecting' | 'error'
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">{analysisDict.requiredReports}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {slots.map((slot) => (
            <SlotCard key={slot.reportType} slot={slot} reportTypesDict={reportTypesDict} analysisDict={analysisDict} />
          ))}
        </div>
      </div>

      <UploadForm locale={locale} hotelId={hotelId} sessionId={sessionId} dict={dict} onUploadSettled={refreshSlots} />

      {status === 'error' && errorMessage ? (
        <Card className="border-status-critical/30 bg-status-critical/[0.06] text-sm text-status-critical">
          <p className="font-medium">{analysisDict.errorTitle}</p>
          <p className="mt-1">{errorMessage}</p>
        </Card>
      ) : null}

      {allFilled ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button size="lg" onClick={handleStart} loading={starting} disabled={starting}>
            {status === 'error' ? analysisDict.retryAnalysis : analysisDict.startAnalysis}
          </Button>
          {startError ? <p className="text-sm text-status-critical">{startError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function SlotCard({
  slot,
  reportTypesDict,
  analysisDict,
}: {
  slot: SessionSlot;
  reportTypesDict: Record<string, string>;
  analysisDict: AnalysisDict;
}) {
  const label = reportTypesDict[slot.reportType] ?? slot.reportType;
  const hasRealExtraction: ReportType = 'MANAGER_FLASH';

  let statusText = analysisDict.slotEmpty;
  let tone: 'neutral' | 'info' | 'positive' | 'warning' = 'neutral';
  if (slot.filled) {
    if (slot.uploadStatus === 'uploaded' || slot.uploadStatus === 'processing') {
      statusText = analysisDict.slotProcessing;
      tone = 'info';
    } else if (slot.uploadStatus === 'error') {
      statusText = analysisDict.slotUnrecognized;
      tone = 'warning';
    } else if (slot.reportType === hasRealExtraction) {
      statusText = analysisDict.slotValidated;
      tone = 'positive';
    } else {
      statusText = analysisDict.slotTypeRecognized;
      tone = 'warning';
    }
  }

  return (
    <Card className="space-y-1.5">
      <p className="metric-value text-sm text-ink">{label}</p>
      {slot.filename ? <p className="truncate text-xs text-ink-muted">{slot.filename}</p> : null}
      <StatusBadge tone={tone}>{statusText}</StatusBadge>
    </Card>
  );
}
