'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from './actions';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/config';

interface Dict {
  username: string;
  password: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  signingIn: string;
  invalidCredentials: string;
  accountDisabled: string;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} loadingText={pendingLabel}>
      {label}
    </Button>
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
    <form action={formAction} className="space-y-5">
      <Input id="username" name="username" type="text" required autoComplete="username" label={dict.username} />
      <PasswordInput
        id="password"
        name="password"
        required
        autoComplete="current-password"
        label={dict.password}
        showLabel={dict.showPassword}
        hideLabel={dict.hidePassword}
      />
      {errorMessage ? (
        <p role="alert" className="rounded-md bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {errorMessage}
        </p>
      ) : null}
      <SubmitButton label={dict.submit} pendingLabel={dict.signingIn} />
    </form>
  );
}
