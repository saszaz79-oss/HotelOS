import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { listReportUploadsPage } from '@/server/modules/reports/queries';

export default async function ReportsArchivePage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ page?: string }>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
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

  const requestedPage = Number(searchParams.page ?? '1');
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const { uploads, total, totalPages } = await listReportUploadsPage(membership.hotelId, page);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-medium">{dict.reportsArchive.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {dict.reportsArchive.count.replace('{count}', String(total))}
        </p>
      </div>

      {uploads.length === 0 ? (
        <p className="text-sm text-ink-muted">{dict.reportsUpload.noUploads}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-start text-ink-muted">
              <th className="py-2 text-start">{dict.reportsArchive.file}</th>
              <th className="py-2 text-start">{dict.reportsArchive.reportType}</th>
              <th className="py-2 text-start">{dict.reportsArchive.uploadedBy}</th>
              <th className="py-2 text-start">{dict.reportsArchive.status}</th>
              <th className="py-2 text-start">{dict.reportsArchive.date}</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((u) => (
              <tr key={u.id} className="border-b border-ink/5">
                <td className="py-2">
                  <Link href={`/${locale}/reports/${u.id}`} className="text-accent hover:underline">
                    {u.originalFilename}
                  </Link>
                </td>
                <td className="py-2 text-ink-muted">{u.documents[0]?.reportType ?? '—'}</td>
                <td className="py-2 text-ink-muted">{u.uploadedBy.displayName}</td>
                <td className="py-2 text-ink-muted">{u.status}</td>
                <td className="py-2 text-ink-muted">{new Date(u.createdAt).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/${locale}/reports/archive?page=${page - 1}`} className="text-accent hover:underline">
              ← {dict.reportsArchive.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            {dict.reportsArchive.pageOf.replace('{page}', String(page)).replace('{totalPages}', String(totalPages))}
          </span>
          {page < totalPages ? (
            <Link href={`/${locale}/reports/archive?page=${page + 1}`} className="text-accent hover:underline">
              {dict.reportsArchive.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
