import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { listReportUploads } from '@/server/modules/reports/queries';
import { UploadForm } from './UploadForm';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { reportStatusTone } from '@/lib/status-tone';

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
        <h1 className="text-xl font-semibold text-ink">{dict.reportsUpload.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.reportsUpload.description}</p>
      </div>

      <UploadForm locale={locale} hotelId={membership.hotelId} dict={dict.reportsUpload} />

      <Card>
        <CardHeader>
          <CardTitle>{dict.reportsUpload.recentUploads}</CardTitle>
        </CardHeader>
        {uploads.length === 0 ? (
          <EmptyState title={dict.reportsUpload.noUploads} />
        ) : (
          <ul className="divide-y divide-ink/5 text-sm">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/${locale}/reports/${u.id}`} className="truncate text-ink hover:underline">
                  {u.originalFilename}
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-ink-muted">{new Date(u.createdAt).toLocaleString(locale)}</span>
                  <StatusBadge tone={reportStatusTone(u.status)}>{u.status}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
