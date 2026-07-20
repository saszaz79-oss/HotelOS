import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getHotelWithDetails } from '@/server/modules/hotels/queries';
import { updateHotelAction, setHotelStatusAction } from './actions';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { hotelStatusTone } from '@/lib/status-tone';

const inputClass = 'w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function isoDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

export default async function AdminHotelDetailPage(
  props: {
    params: Promise<{ locale: string; hotelId: string }>;
  }
) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const hotel = await getHotelWithDetails(params.hotelId);

  if (!hotel) return <p className="text-ink-muted">Not found.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-medium text-ink">{hotel.name}</h1>
          <StatusBadge tone={hotelStatusTone(hotel.status)}>{hotel.status}</StatusBadge>
        </div>
        <div className="flex gap-2">
          <form action={setHotelStatusAction.bind(null, locale, hotel.id, 'active')}>
            <Button type="submit" variant="secondary" size="sm">
              {dict.admin.hotels.activate}
            </Button>
          </form>
          <form action={setHotelStatusAction.bind(null, locale, hotel.id, 'suspended')}>
            <Button type="submit" variant="secondary" size="sm">
              {dict.admin.hotels.suspend}
            </Button>
          </form>
          <form action={setHotelStatusAction.bind(null, locale, hotel.id, 'archived')}>
            <Button type="submit" variant="danger" size="sm">
              {dict.admin.hotels.archive}
            </Button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/${locale}/admin/feature-flags/${hotel.id}`}>
          <Button variant="secondary" size="sm">{dict.admin.nav.featureFlags}</Button>
        </Link>
        <Link href={`/${locale}/admin/support/${hotel.id}`}>
          <Button variant="secondary" size="sm">{dict.admin.nav.support}</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.admin.hotels.title}</CardTitle>
        </CardHeader>
        <form action={updateHotelAction.bind(null, locale, hotel.id)} className="grid grid-cols-2 gap-4">
          <Field label={dict.admin.hotels.name}>
            <input name="name" defaultValue={hotel.name} required className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.logo}>
            <input name="logoUrl" type="url" defaultValue={hotel.logoUrl ?? ''} className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.country}>
            <input name="country" defaultValue={hotel.country} required className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.city}>
            <input name="city" defaultValue={hotel.city} required className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.currency}>
            <input name="currency" defaultValue={hotel.currency} required className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.timezone}>
            <input name="timezone" defaultValue={hotel.timezone} required className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.totalRooms}>
            <input name="totalRooms" type="number" min={1} defaultValue={hotel.totalRooms} required className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.pmsType}>
            <input name="pmsType" defaultValue={hotel.pmsType ?? ''} className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.licenseStart}>
            <input name="licenseStartDate" type="date" defaultValue={isoDate(hotel.licenseStartDate)} className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.licenseExpiry}>
            <input name="licenseExpiryDate" type="date" defaultValue={isoDate(hotel.licenseExpiryDate)} className={inputClass} />
          </Field>
          <Field label={dict.admin.hotels.subscriptionPlan}>
            <select name="subscriptionPlan" defaultValue={hotel.subscription?.plan ?? 'pilot'} className={inputClass}>
              <option value="pilot">Pilot</option>
              <option value="standard">Standard</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Button type="submit">{dict.admin.hotels.saveEdit}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.admin.hotels.members}</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-ink/5 text-sm">
          {hotel.memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span className="text-ink">{m.user.displayName} ({m.user.username})</span>
              <span className="text-ink-muted">{m.role}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
