'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from './actions';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useLampGlow } from './LampScene';
import { cn } from '@/lib/cn';
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

// Dark-glass-card overrides for the shared Input/PasswordInput fields —
// scoped to this form only via className merge, the components themselves
// stay untouched for every other (light) screen that uses them.
const darkFieldClass =
  'border-white/15 bg-white/5 text-white placeholder:text-white/35 ' +
  'focus:border-[hsl(38_55%_65%)] focus:ring-[hsl(38_55%_65%)]/25';
const darkLabelClass = '[&+label]:text-white/70';

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  const lampOn = useLampGlow();
  return (
    <Button
      type="submit"
      size="lg"
      className={cn('w-full transition-shadow duration-500', lampOn && 'shadow-[0_0_24px_2px_hsl(38_75%_55%/0.45)]')}
      loading={pending}
      loadingText={pendingLabel}
    >
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
    <form action={formAction} className={cn('space-y-5', darkLabelClass)}>
      <div className="[&_label]:text-white/70">
        <Input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          label={dict.username}
          className={darkFieldClass}
        />
      </div>
      <div className="[&_label]:text-white/70">
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          label={dict.password}
          showLabel={dict.showPassword}
          hideLabel={dict.hidePassword}
          className={darkFieldClass}
        />
      </div>
      {errorMessage ? (
        <p role="alert" className="rounded-md bg-status-critical/15 px-3 py-2 text-sm text-red-300">
          {errorMessage}
        </p>
      ) : null}
      <SubmitButton label={dict.submit} pendingLabel={dict.signingIn} />
    </form>
  );
}
