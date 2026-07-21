import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { listReportUploadsPage, listReportUploaders, type ListReportUploadsFilter } from '@/server/modules/reports/queries';
import type { ReportType, ReportUploadStatus } from '@prisma/client';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';
import { reportStatusTone } from '@/lib/status-tone';
import { deleteReportAction } from './actions';
import { DeleteReportButton } from '../DeleteReportButton';

const filterFieldClass =
  'rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-3 py-2 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

const REPORT_TYPES: ReportType[] = ['MANAGER_FLASH', 'RESERVATION_STATISTICS', 'RESERVATION_STATISTICS_1', 'OPEN_BALANCE', 'GENERIC'];
const STATUSES: ReportUploadStatus[] = ['uploaded', 'processing', 'needs_review', 'complete', 'error'];

function processingDuration(upload: { createdAt: Date; status: string }, doc: { updatedAt: Date } | undefined, dict: { inProgress: string }): string {
  if (upload.status === 'uploaded' || upload.status === 'processing' || !doc) return dict.inProgress;
  const ms = doc.updatedAt.getTime() - upload.createdAt.getTime();
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export default async function ReportsArchivePage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{
      page?: string;
      q?: string;
      type?: string;
      status?: string;
      uploadedBy?: string;
      from?: string;
      to?: string;
    }>;
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

  const filter: ListReportUploadsFilter = {
    search: searchParams.q?.trim() || undefined,
    reportType: REPORT_TYPES.includes(searchParams.type as ReportType) ? (searchParams.type as ReportType) : undefined,
    status: STATUSES.includes(searchParams.status as ReportUploadStatus) ? (searchParams.status as ReportUploadStatus) : undefined,
    uploadedByUserId: searchParams.uploadedBy || undefined,
    dateFrom: searchParams.from ? new Date(searchParams.from) : undefined,
    dateTo: searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : undefined,
  };

  const [{ uploads, total, totalPages }, uploaders] = await Promise.all([
    listReportUploadsPage(membership.hotelId, page, filter),
    listReportUploaders(membership.hotelId),
  ]);

  const canDelete = membership.role === 'HOTEL_ADMIN';

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{dict.reportsArchive.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.reportsArchive.count.replace('{count}', String(total))}</p>
      </div>

      <form className="flex flex-wrap gap-2" action={`/${locale}/reports/archive`}>
        <input
          type="text"
          name="q"
          defaultValue={filter.search}
          placeholder={dict.reportsArchive.searchPlaceholder}
          className={`min-w-[200px] flex-1 ${filterFieldClass}`}
        />
        <select name="type" defaultValue={filter.reportType ?? ''} className={filterFieldClass}>
          <option value="">{dict.reportsArchive.filterAllTypes}</option>
          {REPORT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filter.status ?? ''} className={filterFieldClass}>
          <option value="">{dict.reportsArchive.filterAllStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="uploadedBy" defaultValue={searchParams.uploadedBy ?? ''} className={filterFieldClass}>
          <option value="">{dict.reportsArchive.filterAllUploaders}</option>
          {uploaders.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={searchParams.from}
          aria-label={dict.reportsArchive.dateFrom}
          className={filterFieldClass}
        />
        <input
          type="date"
          name="to"
          defaultValue={searchParams.to}
          aria-label={dict.reportsArchive.dateTo}
          className={filterFieldClass}
        />
        <Button type="submit" variant="secondary" size="sm">
          {dict.reportsArchive.search}
        </Button>
        <Link href={`/${locale}/reports/archive`} className="rounded-md px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink">
          {dict.reportsArchive.clearFilters}
        </Link>
      </form>

      {uploads.length === 0 ? (
        <EmptyState title={dict.reportsArchive.noResults} />
      ) : (
        <>
          <TableShell className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadRowClass}>
                  <th className={tableHeadCellClass}>{dict.reportsArchive.file}</th>
                  <th className={tableHeadCellClass}>{dict.reportsArchive.reportType}</th>
                  <th className={tableHeadCellClass}>{dict.reportsArchive.uploadedBy}</th>
                  <th className={tableHeadCellClass}>{dict.reportsArchive.status}</th>
                  <th className={tableHeadCellClass}>{dict.reportsArchive.dataQuality}</th>
                  <th className={tableHeadCellClass}>{dict.reportsArchive.duration}</th>
                  <th className={tableHeadCellClass}>{dict.reportsArchive.date}</th>
                  {canDelete ? <th className={tableHeadCellClass} /> : null}
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => {
                  const doc = u.documents[0];
                  return (
                    <tr key={u.id} className={tableRowClass}>
                      <td className={tableCellClass}>
                        <Link href={`/${locale}/reports/${u.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                          {u.originalFilename}
                        </Link>
                      </td>
                      <td className={`${tableCellClass} text-ink-muted`}>{doc?.reportType ?? '—'}</td>
                      <td className={`${tableCellClass} text-ink-muted`}>{u.uploadedBy.displayName}</td>
                      <td className={tableCellClass}>
                        <StatusBadge tone={reportStatusTone(u.status)}>{u.status}</StatusBadge>
                      </td>
                      <td className={`metric-value ${tableCellClass} text-ink-muted`}>
                        {doc?.completenessScore !== null && doc?.completenessScore !== undefined
                          ? `${Math.round(doc.completenessScore * 100)}%`
                          : '—'}
                      </td>
                      <td className={`metric-value ${tableCellClass} text-ink-muted`}>{processingDuration(u, doc, dict.reportsArchive)}</td>
                      <td className={`${tableCellClass} text-ink-muted`}>{new Date(u.createdAt).toLocaleDateString(locale)}</td>
                      {canDelete ? (
                        <td className={tableCellClass}>
                          {u.status !== 'complete' ? (
                            <DeleteReportButton
                              action={deleteReportAction.bind(null, locale, membership.hotelId, u.id)}
                              dict={dict.reportsArchive}
                            />
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>

          <div className="space-y-3 md:hidden">
            {uploads.map((u) => {
              const doc = u.documents[0];
              return (
                <Card key={u.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/${locale}/reports/${u.id}`} className="truncate font-medium text-ink hover:text-accent hover:underline">
                      {u.originalFilename}
                    </Link>
                    <StatusBadge tone={reportStatusTone(u.status)}>{u.status}</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {doc?.reportType ?? '—'} · {u.uploadedBy.displayName} · {new Date(u.createdAt).toLocaleDateString(locale)}
                  </p>
                  <div className="mt-2 flex gap-4 text-xs text-ink-muted">
                    <span>
                      {dict.reportsArchive.dataQuality}:{' '}
                      <span className="metric-value text-ink">
                        {doc?.completenessScore !== null && doc?.completenessScore !== undefined
                          ? `${Math.round(doc.completenessScore * 100)}%`
                          : '—'}
                      </span>
                    </span>
                    <span>
                      {dict.reportsArchive.duration}:{' '}
                      <span className="metric-value text-ink">{processingDuration(u, doc, dict.reportsArchive)}</span>
                    </span>
                  </div>
                  {canDelete && u.status !== 'complete' ? (
                    <div className="mt-3">
                      <DeleteReportButton
                        action={deleteReportAction.bind(null, locale, membership.hotelId, u.id)}
                        dict={dict.reportsArchive}
                      />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </>
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
