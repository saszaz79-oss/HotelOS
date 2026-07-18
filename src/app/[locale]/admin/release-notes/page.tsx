import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { RELEASE_NOTES } from '@/lib/release-notes';

export default async function AdminReleaseNotesPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-medium">{dict.admin.nav.releaseNotes}</h1>
      <div className="space-y-6 text-sm">
        {RELEASE_NOTES.map((section) => (
          <div key={section.title}>
            <h2 className="text-base font-medium">{section.title}</h2>
            <ul className="mt-2 space-y-1">
              {section.items.map((item, i) => (
                <li key={i} className="ms-4 text-ink-muted">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
