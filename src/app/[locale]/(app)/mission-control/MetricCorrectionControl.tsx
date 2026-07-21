'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import type { CorrectMetricActionResult } from './actions';

interface Dict {
  correctAction: string;
  cancel: string;
  newValueLabel: string;
  reasonLabel: string;
  submit: string;
  success: string;
  history: string;
  errors: Record<string, string>;
}

export interface CorrectionHistoryItem {
  id: string;
  correctedByDisplayName: string;
  createdAt: string;
  previousValue: number | null;
  newValue: number | null;
  reason: string | null;
}

type FormState = CorrectMetricActionResult & { hasResult?: boolean };
const initialState: FormState = { ok: true, hasResult: false };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/** Inline "flag -> correct -> audit" control for a consistency-flagged KPI (Analytics fix, Phase 4) — only ever rendered when insights/consistency.ts actually flagged this metric, and only shows an edit control to HOTEL_ADMIN/GENERAL_MANAGER (checked again server-side in the action, this is UX only). */
export function MetricCorrectionControl({
  action,
  canCorrect,
  alertMessage,
  history,
  dict,
}: {
  /** correctMetricAction already bound to (locale, hotelId, metricDateIso, metricKey) — only formData remains. */
  action: (formData: FormData) => Promise<CorrectMetricActionResult>;
  canCorrect: boolean;
  alertMessage: string;
  history: CorrectionHistoryItem[];
  dict: Dict;
}) {
  const [open, setOpen] = useState(false);
  const wrapped = async (_prevState: FormState, formData: FormData): Promise<FormState> => {
    const result = await action(formData);
    return { ...result, hasResult: true };
  };
  const [state, formAction] = useFormState(wrapped, initialState);

  return (
    <div className="mt-2 rounded-lg border border-status-warning/30 bg-status-warning/[0.06] p-2 text-xs">
      <p className="text-status-warning">{alertMessage}</p>

      {canCorrect ? (
        open ? (
          <form action={formAction} className="mt-2 space-y-1.5">
            <input
              name="newValue"
              type="number"
              step="any"
              required
              placeholder={dict.newValueLabel}
              className="w-full rounded-md border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-2 py-1 text-xs"
            />
            <input
              name="reason"
              type="text"
              required
              placeholder={dict.reasonLabel}
              className="w-full rounded-md border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-2 py-1 text-xs"
            />
            <div className="flex items-center gap-2">
              <SubmitButton label={dict.submit} />
              <button type="button" onClick={() => setOpen(false)} className="text-ink-muted hover:underline">
                {dict.cancel}
              </button>
            </div>
            {state.hasResult && !state.ok ? <p className="text-status-critical">{dict.errors[state.reason] ?? state.reason}</p> : null}
            {state.hasResult && state.ok ? <p className="text-status-positive">{dict.success}</p> : null}
          </form>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="mt-1 text-accent hover:underline">
            {dict.correctAction}
          </button>
        )
      ) : null}

      {history.length > 0 ? (
        <details className="group mt-2">
          <summary className="cursor-pointer text-ink-muted marker:content-none">{dict.history}</summary>
          <ul className="mt-1 space-y-1 text-ink-muted">
            {history.map((h) => (
              <li key={h.id}>
                {h.correctedByDisplayName} ({h.createdAt}): {h.previousValue ?? '—'} → {h.newValue ?? '—'} — {h.reason ?? '—'}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
