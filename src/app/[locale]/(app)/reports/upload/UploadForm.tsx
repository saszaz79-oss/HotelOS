'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { uploadSingleReportAction, getUploadStatusAction } from './actions';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/Button';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';

interface Dict {
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

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';
type ProcessingStatus = 'uploaded' | 'processing' | 'needs_review' | 'complete' | 'error' | null;

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
  reportUploadId?: string;
  processingStatus: ProcessingStatus;
  processingError?: string | null;
  pollExhausted?: boolean;
}

function validateFile(file: File): string | null {
  if (file.type !== 'application/pdf') return 'INVALID_FILE_TYPE';
  if (file.size === 0) return 'EMPTY_FILE';
  if (file.size > MAX_FILE_SIZE_BYTES) return 'FILE_TOO_LARGE';
  return null;
}

// Terminal processing states — polling stops once one of these is reached,
// matching the actual lifecycle the extraction pipeline writes
// (report-extraction/commands.ts): uploaded -> processing -> one of these three.
const TERMINAL_STATUSES = new Set(['needs_review', 'complete', 'error']);
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // ~2 minutes — generous ceiling, not a real timeout guarantee

function processingLabel(status: ProcessingStatus, dict: Dict): { text: string; tone: StatusTone } | null {
  switch (status) {
    case 'uploaded':
      return { text: dict.processingUploaded, tone: 'info' };
    case 'processing':
      return { text: dict.processingProcessing, tone: 'info' };
    case 'needs_review':
      return { text: dict.processingNeedsReview, tone: 'warning' };
    case 'complete':
      return { text: dict.processingComplete, tone: 'positive' };
    case 'error':
      return { text: dict.processingFailed, tone: 'critical' };
    default:
      return null;
  }
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 40 40" className="mx-auto h-10 w-10 text-ink-muted" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M20 25V8M20 8l-6 6M20 8l6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 24v5a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UploadForm({
  locale,
  hotelId,
  sessionId,
  dict,
  onUploadSettled,
}: {
  locale: Locale;
  hotelId: string;
  sessionId: string;
  dict: Dict;
  /** Called after each upload settles (success or error) — lets the parent Analysis Session panel refresh its slot cards without waiting for its next poll tick. */
  onUploadSettled?: () => void;
}) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  function pollStatus(itemId: string, reportUploadId: string, attempt: number) {
    if (attempt > MAX_POLL_ATTEMPTS) {
      // Background processing (Perf fix, Phase 1A) has no supervisor that
      // guarantees a terminal status within any fixed window — say so
      // explicitly rather than silently going quiet, which used to read as
      // a frozen UI once this ceiling was actually reachable.
      setQueue((prev) => prev.map((f) => (f.id === itemId ? { ...f, pollExhausted: true } : f)));
      return;
    }
    const timer = setTimeout(async () => {
      const { status, errorMessage } = await getUploadStatusAction(hotelId, reportUploadId);
      setQueue((prev) => prev.map((f) => (f.id === itemId ? { ...f, processingStatus: status, processingError: errorMessage } : f)));
      if (status && !TERMINAL_STATUSES.has(status)) {
        pollStatus(itemId, reportUploadId, attempt + 1);
      } else {
        // Terminal status reached — this is when the document's detected
        // report type actually becomes known, so the parent's slot cards
        // need a refresh now, not just at upload time.
        onUploadSettled?.();
        pollTimers.current.delete(itemId);
      }
    }, POLL_INTERVAL_MS);
    pollTimers.current.set(itemId, timer);
  }

  function addFiles(fileList: FileList | File[]) {
    const next: QueuedFile[] = Array.from(fileList).map((file) => {
      const error = validateFile(file);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: error ? 'error' : 'pending',
        error: error ?? undefined,
        processingStatus: null,
      };
    });
    setQueue((prev) => [...prev, ...next]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, []);

  function removeFile(id: string) {
    const timer = pollTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      pollTimers.current.delete(id);
    }
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }

  async function uploadOne(item: QueuedFile) {
    setQueue((prev) => prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading', error: undefined } : f)));
    const formData = new FormData();
    formData.set('file', item.file);
    const result = await uploadSingleReportAction(locale, hotelId, sessionId, formData);
    setQueue((prev) =>
      prev.map((f) =>
        f.id === item.id
          ? result.ok
            ? { ...f, status: 'success', reportUploadId: result.reportUploadId, processingStatus: 'uploaded' }
            : { ...f, status: 'error', error: result.error }
          : f
      )
    );
    onUploadSettled?.();
    if (result.ok) {
      pollStatus(item.id, result.reportUploadId, 1);
    }
  }

  async function uploadAll() {
    const pending = queue.filter((f) => f.status === 'pending');
    for (const item of pending) {
      // Sequential, not Promise.all — keeps upload order predictable and
      // avoids saturating the 15MB-per-request server action body limit
      // with several large PDFs racing at once.
      await uploadOne(item);
    }
  }

  const hasPending = queue.some((f) => f.status === 'pending');
  const isUploading = queue.some((f) => f.status === 'uploading');
  const hasFinished = queue.some((f) => f.status === 'success' || f.status === 'error');

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-ink/15 hover:border-ink/30'
        )}
      >
        <UploadIcon />
        <p className="mt-3 text-sm text-ink">{dict.dragDropHint}</p>
        <p className="mt-2">
          <span className="text-sm font-medium text-accent underline">{dict.browse}</span>
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          {dict.acceptedTypesHint} · {dict.maxSizeHint}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {queue.length > 0 ? (
        <div className="space-y-2">
          <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10">
            {queue.map((item) => {
              const processing = item.status === 'success' ? processingLabel(item.processingStatus, dict) : null;
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{item.file.name}</p>
                    <p className="text-xs text-ink-muted">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    {item.status === 'uploading' ? (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink/5">
                        <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
                      </div>
                    ) : null}
                    {item.status === 'success' && item.processingStatus === 'error' && item.processingError ? (
                      <p className="mt-1 truncate text-xs text-status-critical" title={item.processingError}>
                        {item.processingError}
                      </p>
                    ) : null}
                    {item.status === 'success' && item.pollExhausted && item.processingStatus !== 'error' && !TERMINAL_STATUSES.has(item.processingStatus ?? '') ? (
                      <p className="mt-1 text-xs text-ink-muted">{dict.processingStillWorking}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === 'pending' ? <StatusBadge tone="neutral">{dict.queued}</StatusBadge> : null}
                    {item.status === 'uploading' ? <StatusBadge tone="info">{dict.uploading}</StatusBadge> : null}
                    {item.status === 'success' && processing ? <StatusBadge tone={processing.tone}>{processing.text}</StatusBadge> : null}
                    {item.status === 'error' ? (
                      <StatusBadge tone="critical">{item.error ? dict.errors[item.error] ?? item.error : ''}</StatusBadge>
                    ) : null}
                    {item.status === 'success' && item.reportUploadId ? (
                      <Link href={`/${locale}/reports/${item.reportUploadId}`} className="text-xs text-accent hover:underline">
                        {dict.viewReport}
                      </Link>
                    ) : null}
                    {item.status === 'error' ? (
                      <button type="button" onClick={() => uploadOne(item)} className="text-xs text-accent hover:underline">
                        {dict.retry}
                      </button>
                    ) : null}
                    {item.status !== 'uploading' ? (
                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        aria-label={dict.remove}
                        className="text-ink-muted transition-colors hover:text-status-critical"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <Button type="button" onClick={uploadAll} disabled={!hasPending || isUploading} loading={isUploading} loadingText={dict.uploading}>
              {dict.submit}
            </Button>
            {hasFinished ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setQueue((prev) => prev.filter((f) => f.status === 'pending' || f.status === 'uploading'))}
              >
                {dict.clear}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
