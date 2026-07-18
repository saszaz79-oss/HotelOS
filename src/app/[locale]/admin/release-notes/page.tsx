import { readFile } from 'fs/promises';
import path from 'path';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';

export default async function AdminReleaseNotesPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  const content = await readFile(changelogPath, 'utf-8').catch(() => '_CHANGELOG.md not found._');

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-medium">{dict.admin.nav.releaseNotes}</h1>
      <div className="space-y-2 text-sm">
        {content.split('\n').map((line, i) => {
          if (line.startsWith('## ')) {
            return (
              <h2 key={i} className="pt-3 text-base font-medium">
                {line.replace('## ', '')}
              </h2>
            );
          }
          if (line.startsWith('# ')) {
            return null; // top-level title already shown above
          }
          if (line.startsWith('- ')) {
            return (
              <p key={i} className="ms-4">
                • {line.replace('- ', '')}
              </p>
            );
          }
          if (line.trim() === '') return null;
          return (
            <p key={i} className="text-ink-muted">
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}
