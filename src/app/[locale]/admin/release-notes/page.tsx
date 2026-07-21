import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { RELEASE_NOTES } from '@/lib/release-notes';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

export default async function AdminReleaseNotesPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-ink">{dict.admin.nav.releaseNotes}</h1>
      <div className="space-y-4">
        {RELEASE_NOTES.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-ink">{section.title}</CardTitle>
            </CardHeader>
            <ul className="space-y-1.5 text-sm text-ink-muted">
              {section.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
