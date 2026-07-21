import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listHotels } from '@/server/modules/hotels/queries';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { hotelStatusTone } from '@/lib/status-tone';

export default async function AdminFeatureFlagsPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const hotels = await listHotels();

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{dict.admin.featureFlags.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.admin.featureFlags.note}</p>
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-ink/5">
          {hotels.map((h) => (
            <li key={h.id}>
              <Link href={`/${locale}/admin/feature-flags/${h.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-ink transition-colors hover:bg-ink/[0.02]">
                <span className="font-medium">{h.name}</span>
                <StatusBadge tone={hotelStatusTone(h.status)}>{h.status}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
