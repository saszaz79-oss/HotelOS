import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { env } from '@/lib/env';

export default function AdminSettingsPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const settings = [
    { label: 'Storage driver', value: env.STORAGE_DRIVER },
    { label: 'AI provider', value: env.AI_PROVIDER },
    { label: 'Notification driver', value: env.NOTIFICATION_DRIVER },
    { label: 'Default locale', value: 'ar (Arabic-first, RTL)' },
    { label: 'Default currency', value: 'SAR' },
  ];

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-lg font-medium">{dict.admin.settings.title}</h1>
      <p className="text-sm text-ink-muted">{dict.admin.settings.note}</p>
      <table className="w-full text-sm">
        <tbody>
          {settings.map((s) => (
            <tr key={s.label} className="border-b border-ink/5">
              <td className="py-2 text-ink-muted">{s.label}</td>
              <td className="py-2">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
