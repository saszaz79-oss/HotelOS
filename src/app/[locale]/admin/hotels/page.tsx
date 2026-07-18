import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listHotels } from '@/server/modules/hotels/queries';

export default async function AdminHotelsPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const hotels = await listHotels();

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">{dict.admin.hotels.title}</h1>
        <Link href={`/${locale}/admin/hotels/new`} className="rounded-md bg-accent px-4 py-2 text-sm text-white">
          {dict.admin.hotels.create}
        </Link>
      </div>

      {hotels.length === 0 ? (
        <p className="text-sm text-ink-muted">No hotels yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-start text-ink-muted">
              <th className="py-2 text-start">{dict.admin.hotels.name}</th>
              <th className="py-2 text-start">{dict.admin.hotels.country}</th>
              <th className="py-2 text-start">{dict.admin.hotels.subscriptionPlan}</th>
              <th className="py-2 text-start">{dict.admin.hotels.status}</th>
              <th className="py-2 text-start">{dict.admin.hotels.members}</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((h) => (
              <tr key={h.id} className="border-b border-ink/5">
                <td className="py-2">
                  <Link href={`/${locale}/admin/hotels/${h.id}`} className="text-accent hover:underline">
                    {h.name}
                  </Link>
                </td>
                <td className="py-2">
                  {h.city}, {h.country}
                </td>
                <td className="py-2">{h.subscription?.plan ?? '—'}</td>
                <td className="py-2">{h.status}</td>
                <td className="py-2 metric-value">{h._count.memberships}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
