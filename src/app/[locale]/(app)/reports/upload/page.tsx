import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { listReportUploads } from '@/server/modules/reports/queries';
import { UploadForm } from './UploadForm';

export default async function ReportsUploadPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  const membership = user && !user.isSuperAdmin ? await getActiveMembership(user.id) : null;

  if (!membership) {
    return (
      <div className="max-w-lg">
        <p className="text-ink-muted">{dict.missionControl.noHotels}</p>
      </div>
    );
  }

  const uploads = await listReportUploads(membership.hotelId, 20);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-medium">{dict.reportsUpload.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.reportsUpload.description}</p>
      </div>

      <UploadForm locale={locale} hotelId={membership.hotelId} dict={dict.reportsUpload} />

      <div>
        <h2 className="text-sm font-medium text-ink-muted">{dict.reportsUpload.recentUploads}</h2>
        {uploads.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{dict.reportsUpload.noUploads}</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink/10 rounded-md border border-ink/10">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <Link href={`/${locale}/reports/${u.id}`} className="hover:underline">
                  {u.originalFilename}
                </Link>
                <span className="text-ink-muted">
                  {u.status} · {new Date(u.createdAt).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
