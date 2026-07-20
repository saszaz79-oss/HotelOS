'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { createHotelAction, type CreateHotelActionState } from './actions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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

const inputClass =
  'w-full rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-3 py-2 text-sm backdrop-blur-xl transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

const initialState: CreateHotelActionState = {};

export function NewHotelForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [state, formAction] = useFormState(createHotelAction, initialState);

  if (state.result) {
    return (
      <Card className="max-w-md space-y-3 border-status-positive/30">
        <p className="text-sm">{dict.createdSuccess}</p>
        <div className="rounded-lg bg-ink/5 p-3 font-mono text-sm">
          <div>Username: {state.result.adminUsername}</div>
          <div>Password: {state.result.temporaryPassword}</div>
        </div>
        <Link href={`/${locale}/admin/hotels/${state.result.hotelId}`} className="text-sm text-accent hover:underline">
          View hotel →
        </Link>
      </Card>
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

      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-ink">{dict.adminSectionTitle}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={dict.adminUsername}>
            <input name="adminUsername" required className={inputClass} />
          </Field>
          <Field label={dict.adminDisplayName}>
            <input name="adminDisplayName" required className={inputClass} />
          </Field>
        </div>
      </Card>

      {state.error ? (
        <p role="alert" className="text-sm text-status-critical">
          {state.error === 'USERNAME_TAKEN' ? dict.usernameTaken : state.error}
        </p>
      ) : null}

      <SubmitButton label={dict.save} />
    </form>
  );
}
