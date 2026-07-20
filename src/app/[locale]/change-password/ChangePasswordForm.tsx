'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changePasswordAction, type ChangePasswordActionState } from './actions';
import { PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/config';

interface Dict {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  updating: string;
  errors: Record<string, string>;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} loadingText={pendingLabel}>
      {label}
    </Button>
  );
}

const initialState: ChangePasswordActionState = {};

export function ChangePasswordForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const boundAction = changePasswordAction.bind(null, locale);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <PasswordInput
        id="currentPassword"
        name="currentPassword"
        required
        autoComplete="current-password"
        label={dict.currentPassword}
        showLabel={dict.showPassword}
        hideLabel={dict.hidePassword}
      />
      <PasswordInput
        id="newPassword"
        name="newPassword"
        required
        minLength={8}
        autoComplete="new-password"
        label={dict.newPassword}
        showLabel={dict.showPassword}
        hideLabel={dict.hidePassword}
      />
      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        required
        minLength={8}
        autoComplete="new-password"
        label={dict.confirmPassword}
        showLabel={dict.showPassword}
        hideLabel={dict.hidePassword}
      />
      {state.error ? (
        <p role="alert" className="rounded-md bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {dict.errors[state.error]}
        </p>
      ) : null}
      <SubmitButton label={dict.submit} pendingLabel={dict.updating} />
    </form>
  );
}
