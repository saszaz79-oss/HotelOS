'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { createHotelAction, type CreateHotelActionState } from './actions';
import type { Locale } from '@/i18n/config';

interface Dict {
  name: string;
  logo: string;
  country: string;
  city: string;
  currency: string;
  timezone: string;
  totalRooms: string;
  pmsType: string;
  licenseStart: string;
  licenseExpiry: string;
  subscriptionPlan: string;
  adminSectionTitle: string;
  adminUsername: string;
  adminDisplayName: string;
  save: string;
  createdSuccess: string;
  usernameTaken: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2 text-sm';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-60">
      {pending ? '…' : label}
    </button>
  );
}

const initialState: CreateHotelActionState = {};

export function NewHotelForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [state, formAction] = useFormState(createHotelAction, initialState);

  if (state.result) {
    return (
      <div className="max-w-md space-y-3 rounded-md border border-status-positive/40 bg-status-positive/10 p-4">
        <p className="text-sm">{dict.createdSuccess}</p>
        <div className="rounded bg-surface-raised p-3 font-mono text-sm">
          <div>Username: {state.result.adminUsername}</div>
          <div>Password: {state.result.temporaryPassword}</div>
        </div>
        <Link href={`/${locale}/admin/hotels/${state.result.hotelId}`} className="text-sm text-accent hover:underline">
          View hotel →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label={dict.name}>
          <input name="name" required className={inputClass} />
        </Field>
        <Field label={dict.logo}>
          <input name="logoUrl" type="url" className={inputClass} />
        </Field>
        <Field label={dict.country}>
          <input name="country" required className={inputClass} />
        </Field>
        <Field label={dict.city}>
          <input name="city" required className={inputClass} />
        </Field>
        <Field label={dict.currency}>
          <input name="currency" defaultValue="SAR" required className={inputClass} />
        </Field>
        <Field label={dict.timezone}>
          <input name="timezone" defaultValue="Asia/Riyadh" required className={inputClass} />
        </Field>
        <Field label={dict.totalRooms}>
          <input name="totalRooms" type="number" min={1} required className={inputClass} />
        </Field>
        <Field label={dict.pmsType}>
          <input name="pmsType" defaultValue="Opera Cloud" className={inputClass} />
        </Field>
        <Field label={dict.licenseStart}>
          <input name="licenseStartDate" type="date" className={inputClass} />
        </Field>
        <Field label={dict.licenseExpiry}>
          <input name="licenseExpiryDate" type="date" className={inputClass} />
        </Field>
        <Field label={dict.subscriptionPlan}>
          <select name="subscriptionPlan" defaultValue="pilot" className={inputClass}>
            <option value="pilot">Pilot</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </Field>
      </div>

      <div className="space-y-4 rounded-md border border-ink/10 p-4">
        <h2 className="text-sm font-medium">{dict.adminSectionTitle}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={dict.adminUsername}>
            <input name="adminUsername" required className={inputClass} />
          </Field>
          <Field label={dict.adminDisplayName}>
            <input name="adminDisplayName" required className={inputClass} />
          </Field>
        </div>
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
