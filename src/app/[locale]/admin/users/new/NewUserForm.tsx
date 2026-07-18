'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createUserAction, type CreateUserActionState } from './actions';

interface Dict {
  username: string;
  displayName: string;
  hotel: string;
  role: string;
  save: string;
  createdSuccess: string;
  usernameTaken: string;
}

const ROLES = ['HOTEL_ADMIN', 'GENERAL_MANAGER', 'FRONT_OFFICE_MANAGER', 'REVENUE_MANAGER', 'ANALYST', 'READ_ONLY'];

const inputClass = 'w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2 text-sm';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-60">
      {pending ? '…' : label}
    </button>
  );
}

const initialState: CreateUserActionState = {};

export function NewUserForm({ dict, hotels }: { dict: Dict; hotels: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createUserAction, initialState);

  if (state.result) {
    return (
      <div className="max-w-md space-y-3 rounded-md border border-status-positive/40 bg-status-positive/10 p-4">
        <p className="text-sm">{dict.createdSuccess}</p>
        <div className="rounded bg-surface-raised p-3 font-mono text-sm">
          <div>Username: {state.result.username}</div>
          <div>Password: {state.result.temporaryPassword}</div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-1">
        <label className="block text-sm text-ink-muted">{dict.username}</label>
        <input name="username" required className={inputClass} />
      </div>
      <div className="space-y-1">
        <label className="block text-sm text-ink-muted">{dict.displayName}</label>
        <input name="displayName" required className={inputClass} />
      </div>
      <div className="space-y-1">
        <label className="block text-sm text-ink-muted">{dict.hotel}</label>
        <select name="hotelId" required className={inputClass}>
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-sm text-ink-muted">{dict.role}</label>
        <select name="role" required className={inputClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-status-critical">
          {state.error === 'USERNAME_TAKEN' ? dict.usernameTaken : state.error}
        </p>
      ) : null}
      <SubmitButton label={dict.save} />
    </form>
  );
}
