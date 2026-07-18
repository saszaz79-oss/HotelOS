import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listHotels } from '@/server/modules/hotels/queries';

export default async function AdminSupportPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const hotels = await listHotels();

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-lg font-medium">{dict.admin.support.title}</h1>
      <p className="text-sm text-ink-muted">{dict.admin.support.note}</p>
      <ul className="space-y-1 text-sm">
        {hotels.map((h) => (
          <li key={h.id}>
            <Link href={`/${locale}/admin/support/${h.id}`} className="text-accent hover:underline">
              {h.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
