import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { getReportUpload, getReportUploadSignedUrl } from '@/server/modules/reports/queries';
import { updateFieldAction, finalizeReportAction, deleteReportFromDetailAction, retryExtractionAction } from './actions';
import { reportTypeLabel } from '@/lib/report-type-label';
import type { ExtractedField } from '@/server/modules/report-extraction/types';
import type { QualityNote } from '@/server/modules/report-extraction/data-quality';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';
import { reportStatusTone } from '@/lib/status-tone';
import { DeleteReportButton } from '../DeleteReportButton';

const fieldInputClass =
  'metric-value w-28 rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-2 py-1.5 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

export default async function ReportReviewPage(
  props: {
    params: Promise<{ locale: string; reportUploadId: string }>;
  }
) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  const membership = user && !user.isSuperAdmin ? await getActiveMembership(user.id) : null;

  if (!membership) {
    return <p className="text-ink-muted">{dict.missionControl.noHotels}</p>;
  }

  const upload = await getReportUpload(membership.hotelId, params.reportUploadId);
  if (!upload) {
    return <p className="text-ink-muted">Not found.</p>;
  }

  const document = upload.documents[0];
  const originalFileUrl = await getReportUploadSignedUrl(upload.storageKey, { hotelId: membership.hotelId, reportUploadId: upload.id });
  const canDelete = membership.role === 'HOTEL_ADMIN' && upload.status !== 'complete';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/${locale}/reports/archive`} className="text-sm text-ink-muted transition-colors hover:text-ink">
          ← {dict.reportsReview.backToUploads}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{dict.reportsReview.title}</h1>
          <div className="flex items-center gap-2">
            <StatusBadge tone={reportStatusTone(upload.status)}>{upload.status}</StatusBadge>
            {upload.status === 'complete' ? (
              <Link href={`/${locale}/reports/export`} className="text-xs text-accent hover:underline">
                {dict.executiveExport.exportLink}
              </Link>
            ) : null}
            {canDelete ? (
              <DeleteReportButton
                action={deleteReportFromDetailAction.bind(null, locale, membership.hotelId, upload.id)}
                dict={dict.reportsArchive}
              />
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {upload.originalFilename}
          {originalFileUrl ? (
            <>
              {' · '}
              <a href={originalFileUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {dict.reportsReview.viewOriginal}
              </a>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {dict.reportsArchive.uploadedBy}: {upload.uploadedBy.displayName} · {new Date(upload.createdAt).toLocaleString(locale)}
        </p>
      </div>

      {upload.status === 'processing' || upload.status === 'uploaded' ? (
        <Card className="text-sm text-ink-muted">{dict.reportsReview.processing}</Card>
      ) : upload.status === 'error' || !document ? (
        <Card className="space-y-3 border-status-critical/30 bg-status-critical/[0.06] text-sm text-status-critical">
          <p>{dict.reportsReview.errorState}</p>
          {upload.status === 'error' ? (
            <form action={retryExtractionAction.bind(null, locale, membership.hotelId, upload.id)}>
              <Button type="submit" size="sm" variant="secondary">
                {dict.reportsReview.retry}
              </Button>
            </form>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-ink-muted">{dict.reportsReview.reportType}</div>
              <div className="metric-value">{reportTypeLabel(document.reportType, dict.reportsCommon.reportTypes)}</div>
            </div>
            <div>
              <div className="text-ink-muted">{dict.reportsReview.detectedDate}</div>
              <div className="metric-value">
                {document.detectedReportDate ? new Date(document.detectedReportDate).toLocaleDateString(locale) : '—'}
              </div>
            </div>
            <div>
              <div className="text-ink-muted">{dict.reportsReview.completeness}</div>
              <div className="metric-value">
                {document.completenessScore !== null ? `${Math.round(document.completenessScore * 100)}%` : '—'}
              </div>
            </div>
            <div>
              <div className="text-ink-muted">{dict.reportsReview.validationStatus}</div>
              <div>
                {document.validationStatus
                  ? dict.reportsReview.status[document.validationStatus as keyof typeof dict.reportsReview.status]
                  : '—'}
              </div>
            </div>
          </Card>

          {document.reportType === 'MANAGER_FLASH' ? (
            <Card className="border-status-warning/30 bg-status-warning/[0.06] text-sm">{dict.reportsReview.unvalidatedNotice}</Card>
          ) : (
            <Card className="text-sm text-ink-muted">{dict.reportsReview.genericNotice}</Card>
          )}

          {(document.extractedFields as unknown as ExtractedField[])?.length > 0 ? (
            <TableShell>
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHeadRowClass}>
                    <th className={tableHeadCellClass}>{dict.reportsReview.field}</th>
                    <th className={tableHeadCellClass}>{dict.reportsReview.value}</th>
                    <th className={tableHeadCellClass}>{dict.reportsReview.confidenceCol}</th>
                    <th className={tableHeadCellClass}>{dict.reportsReview.sourcePage}</th>
                    <th className={tableHeadCellClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(document.extractedFields as unknown as ExtractedField[]).map((field) => (
                    <tr key={field.metricKey} className={tableRowClass}>
                      <td className={`${tableCellClass} text-ink`}>{field.labelEn}</td>
                      <td className={tableCellClass}>
                        <form
                          action={updateFieldAction.bind(
                            null,
                            locale,
                            membership.hotelId,
                            upload.id,
                            document.id
                          )}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="metricKey" value={field.metricKey} />
                          <input
                            type="number"
                            step="any"
                            name="value"
                            defaultValue={field.value ?? ''}
                            placeholder={dict.reportsReview.notFound}
                            className={fieldInputClass}
                          />
                          <button type="submit" className="text-xs text-accent hover:underline">
                            {dict.reportsReview.save}
                          </button>
                        </form>
                      </td>
                      <td className={`${tableCellClass} text-ink-muted`}>{Math.round(field.confidence * 100)}%</td>
                      <td className={`${tableCellClass} text-ink-muted`}>{field.sourcePage ?? '—'}</td>
                      <td className={tableCellClass}>
                        <span
                          className={
                            'text-xs ' +
                            (field.status === 'verified'
                              ? 'text-status-positive'
                              : field.status === 'ambiguous' || field.status === 'missing'
                              ? 'text-status-critical'
                              : 'text-status-warning')
                          }
                        >
                          {dict.reportsReview.fieldStatus[field.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : null}

          {(document.parserWarnings as unknown as string[])?.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium text-ink-muted">{dict.reportsReview.parserWarnings}</h2>
              <ul className="mt-2 space-y-1 text-sm text-status-warning">
                {(document.parserWarnings as unknown as string[]).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(document.qualityNotes as unknown as QualityNote[])?.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium text-ink-muted">{dict.reportsReview.qualityNotes}</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {(document.qualityNotes as unknown as QualityNote[]).map((note, i) => (
                  <li key={i} className="text-status-warning">
                    {note.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {upload.status === 'complete' ? (
            <Card className="border-status-positive/30 bg-status-positive/[0.06] text-sm text-status-positive">
              {dict.reportsReview.finalized}
            </Card>
          ) : (
            <Card>
              <form
                action={finalizeReportAction.bind(null, locale, membership.hotelId, upload.id, document.id)}
                className="flex flex-wrap items-end gap-3"
              >
                <div className="space-y-1">
                  <label htmlFor="confirmedReportDate" className="text-sm text-ink-muted">
                    {dict.reportsReview.confirmDate}
                  </label>
                  <input
                    id="confirmedReportDate"
                    name="confirmedReportDate"
                    type="date"
                    required
                    defaultValue={
                      document.detectedReportDate
                        ? new Date(document.detectedReportDate).toISOString().slice(0, 10)
                        : ''
                    }
                    className={fieldInputClass.replace('w-28', '')}
                  />
                </div>
                <Button type="submit">{dict.reportsReview.finalize}</Button>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
