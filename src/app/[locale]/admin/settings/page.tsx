import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { env } from '@/lib/env';
import { Card } from '@/components/ui/Card';

export default async function AdminSettingsPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const settings = [
    { label: dict.admin.settings.storageDriver, value: env.STORAGE_DRIVER },
    { label: dict.admin.settings.aiProvider, value: env.AI_PROVIDER },
    { label: dict.admin.settings.notificationDriver, value: env.NOTIFICATION_DRIVER },
    { label: dict.admin.settings.defaultLocale, value: dict.admin.settings.defaultLocaleValue },
    { label: dict.admin.settings.defaultCurrency, value: 'SAR' },
  ];

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{dict.admin.settings.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.admin.settings.note}</p>
      </div>
      <Card>
        <ul className="divide-y divide-ink/5">
          {settings.map((s) => (
            <li key={s.label} className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0">
              <span className="text-ink-muted">{s.label}</span>
              <span className="metric-value text-ink">{s.value}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
