'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changePasswordAction, type ChangePasswordActionState } from './actions';
import type { Locale } from '@/i18n/config';

interface Dict {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  submit: string;
  errors: Record<string, string>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-md bg-accent px-4 py-2.5 text-white disabled:opacity-60">
      {pending ? '…' : label}
    </button>
  );
}

const initialState: ChangePasswordActionState = {};

export function ChangePasswordForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const boundAction = changePasswordAction.bind(null, locale);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <label htmlFor="currentPassword" className="text-sm text-ink-muted">
          {dict.currentPassword}
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="newPassword" className="text-sm text-ink-muted">
          {dict.newPassword}
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="text-sm text-ink-muted">
          {dict.confirmPassword}
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-status-critical">
          {dict.errors[state.error]}
        </p>
      ) : null}
      <SubmitButton label={dict.submit} />
    </form>
  );
}
