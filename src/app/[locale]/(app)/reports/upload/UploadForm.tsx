'use client';

import { useCallback, useRef, useState } from 'react';
import { uploadSingleReportAction } from './actions';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
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
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
}

function validateFile(file: File): string | null {
  if (file.type !== 'application/pdf') return 'INVALID_FILE_TYPE';
  if (file.size === 0) return 'EMPTY_FILE';
  if (file.size > MAX_FILE_SIZE_BYTES) return 'FILE_TOO_LARGE';
  return null;
}

export function UploadForm({ locale, hotelId, dict }: { locale: Locale; hotelId: string; dict: Dict }) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | File[]) {
    const next: QueuedFile[] = Array.from(fileList).map((file) => {
      const error = validateFile(file);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: error ? 'error' : 'pending',
        error: error ?? undefined,
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
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }

  async function uploadOne(item: QueuedFile) {
    setQueue((prev) => prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading', error: undefined } : f)));
    const formData = new FormData();
    formData.set('file', item.file);
    const result = await uploadSingleReportAction(locale, hotelId, formData);
    setQueue((prev) =>
      prev.map((f) =>
        f.id === item.id
          ? result.ok
            ? { ...f, status: 'success' }
            : { ...f, status: 'error', error: result.error }
          : f
      )
    );
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
          'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-ink/15 hover:border-ink/30'
        )}
      >
        <p className="text-sm text-ink">{dict.dragDropHint}</p>
        <p className="mt-2">
          <span className="text-sm font-medium text-accent underline">{dict.browse}</span>
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
          <ul className="divide-y divide-ink/5 rounded-md border border-ink/10">
            {queue.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{item.file.name}</p>
                  <p className="text-xs text-ink-muted">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.status === 'pending' ? <StatusBadge tone="neutral">{dict.queued}</StatusBadge> : null}
                  {item.status === 'uploading' ? <StatusBadge tone="info">{dict.uploading}</StatusBadge> : null}
                  {item.status === 'success' ? <StatusBadge tone="positive">{dict.success}</StatusBadge> : null}
                  {item.status === 'error' ? (
                    <StatusBadge tone="critical">{item.error ? dict.errors[item.error] ?? item.error : ''}</StatusBadge>
                  ) : null}
                  {item.status === 'error' ? (
                    <button
                      type="button"
                      onClick={() => uploadOne(item)}
                      className="text-xs text-accent hover:underline"
                    >
                      {dict.retry}
                    </button>
                  ) : null}
                  {item.status !== 'uploading' ? (
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      aria-label={dict.remove}
                      className="text-ink-muted hover:text-status-critical"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
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
