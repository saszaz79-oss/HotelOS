'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { uploadReportsAction, type UploadActionState } from './actions';
import type { Locale } from '@/i18n/config';

interface Dict {
  selectFiles: string;
  submit: string;
  uploading: string;
  success: string;
  errors: Record<string, string>;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

const initialState: UploadActionState = { results: [] };

export function UploadForm({ locale, hotelId, dict }: { locale: Locale; hotelId: string; dict: Dict }) {
  const boundAction = uploadReportsAction.bind(null, locale, hotelId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <input
          type="file"
          name="files"
          accept="application/pdf"
          multiple
          required
          className="block w-full rounded-md border border-ink/10 bg-surface-raised p-2 text-sm"
        />
        <SubmitButton label={dict.submit} pendingLabel={dict.uploading} />
      </form>

      {state.results.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {state.results.map(({ filename, result }, i) => (
            <li key={i} className={result.ok ? 'text-status-positive' : 'text-status-critical'}>
              {filename}: {result.ok ? dict.success : dict.errors[result.error] ?? result.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
