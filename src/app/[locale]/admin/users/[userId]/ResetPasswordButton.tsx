'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { resetPasswordAction, type ResetPasswordActionState } from './actions';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/config';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

const initialState: ResetPasswordActionState = {};

export function ResetPasswordButton({ locale, userId, label, successLabel }: { locale: Locale; userId: string; label: string; successLabel: string }) {
  const boundAction = resetPasswordAction.bind(null, locale, userId);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (state.temporaryPassword) {
    return (
      <div className="rounded-lg border border-status-positive/30 bg-status-positive/10 p-3 text-sm">
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
