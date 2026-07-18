import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getHotelWithDetails } from '@/server/modules/hotels/queries';
import { updateHotelAction, setHotelStatusAction } from './actions';

const inputClass = 'w-full rounded-md border border-ink/10 bg-surface-raised px-3 py-2 text-sm';

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
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">{hotel.name}</h1>
        <div className="flex gap-2">
          <form action={setHotelStatusAction.bind(null, locale, hotel.id, 'active')}>
            <button type="submit" className="rounded-md border border-ink/10 px-3 py-1.5 text-xs hover:bg-surface-raised">
              {dict.admin.hotels.activate}
            </button>
          </form>
          <form action={setHotelStatusAction.bind(null, locale, hotel.id, 'suspended')}>
            <button type="submit" className="rounded-md border border-ink/10 px-3 py-1.5 text-xs hover:bg-surface-raised">
              {dict.admin.hotels.suspend}
            </button>
          </form>
          <form action={setHotelStatusAction.bind(null, locale, hotel.id, 'archived')}>
            <button type="submit" className="rounded-md border border-ink/10 px-3 py-1.5 text-xs hover:bg-surface-raised">
              {dict.admin.hotels.archive}
            </button>
          </form>
        </div>
      </div>
      <p className="text-sm">
        {dict.admin.hotels.status}: <span className="metric-value">{hotel.status}</span>
      </p>

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
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm text-white">
            {dict.admin.hotels.saveEdit}
          </button>
        </div>
      </form>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">{dict.admin.hotels.members}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {hotel.memberships.map((m) => (
            <li key={m.id}>
              {m.user.displayName} ({m.user.username}) — {m.role}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
