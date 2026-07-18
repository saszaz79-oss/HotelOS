'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from './actions';
import type { Locale } from '@/i18n/config';

interface Dict {
  title: string;
  username: string;
  password: string;
  submit: string;
  forgotPassword: string;
  invalidCredentials: string;
  accountDisabled: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-accent px-4 py-2.5 text-white disabled:opacity-60"
    >
      {pending ? '…' : label}
    </button>
  );
}

export function LoginForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const boundAction = loginAction.bind(null, locale);
  const [state, formAction] = useFormState(boundAction, {});

  const errorMessage =
    state.error === 'ACCOUNT_DISABLED'
      ? dict.accountDisabled
      : state.error
      ? dict.invalidCredentials
      : null;

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <label htmlFor="username" className="text-sm text-ink-muted">
          {dict.username}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm text-ink-muted">
          {dict.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2"
        />
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-status-critical">
          {errorMessage}
        </p>
      ) : null}
      <SubmitButton label={dict.submit} />
    </form>
  );
}
