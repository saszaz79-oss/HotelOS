'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { resetPasswordAction, type ResetPasswordActionState } from './actions';
import type { Locale } from '@/i18n/config';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md border border-ink/10 px-3 py-1.5 text-xs hover:bg-surface-raised">
      {pending ? '…' : label}
    </button>
  );
}

const initialState: ResetPasswordActionState = {};

export function ResetPasswordButton({ locale, userId, label, successLabel }: { locale: Locale; userId: string; label: string; successLabel: string }) {
  const boundAction = resetPasswordAction.bind(null, locale, userId);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (state.temporaryPassword) {
    return (
      <div className="rounded-md border border-status-positive/40 bg-status-positive/10 p-3 text-sm">
        <p>{successLabel}</p>
        <p className="mt-1 font-mono">{state.temporaryPassword}</p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <SubmitButton label={label} />
    </form>
  );
}
