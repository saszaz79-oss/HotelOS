import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { getReportUpload } from '@/server/modules/reports/queries';
import { updateFieldAction, finalizeReportAction } from './actions';
import type { ExtractedField } from '@/server/modules/report-extraction/types';
import type { QualityNote } from '@/server/modules/report-extraction/data-quality';

export default async function ReportReviewPage(
  props: {
    params: Promise<{ locale: string; reportUploadId: string }>;
  }
) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  const membership = user && !user.isSuperAdmin
    ? await prisma.hotelMembership.findFirst({ where: { userId: user.id, status: 'active' } })
    : null;

  if (!membership) {
    return <p className="text-ink-muted">{dict.missionControl.noHotels}</p>;
  }

  const upload = await getReportUpload(membership.hotelId, params.reportUploadId);
  if (!upload) {
    return <p className="text-ink-muted">Not found.</p>;
  }

  const document = upload.documents[0];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/${locale}/reports/upload`} className="text-sm text-ink-muted hover:text-ink">
          ← {dict.reportsReview.backToUploads}
        </Link>
        <h1 className="mt-2 text-xl font-medium">{dict.reportsReview.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{upload.originalFilename}</p>
      </div>

      {upload.status === 'processing' || upload.status === 'uploaded' ? (
        <p className="text-sm text-ink-muted">{dict.reportsReview.processing}</p>
      ) : upload.status === 'error' || !document ? (
        <p className="text-sm text-status-critical">{dict.reportsReview.errorState}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 rounded-md border border-ink/10 p-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-ink-muted">{dict.reportsReview.reportType}</div>
              <div className="metric-value">{document.reportType}</div>
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
          </div>

          {document.reportType === 'MANAGER_FLASH' ? (
            <p className="rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
              {dict.reportsReview.unvalidatedNotice}
            </p>
          ) : (
            <p className="rounded-md border border-ink/10 bg-surface-raised p-3 text-sm text-ink-muted">
              {dict.reportsReview.genericNotice}
            </p>
          )}

          {(document.extractedFields as unknown as ExtractedField[])?.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-start text-ink-muted">
                  <th className="py-2 text-start">{dict.reportsReview.field}</th>
                  <th className="py-2 text-start">{dict.reportsReview.value}</th>
                  <th className="py-2 text-start">{dict.reportsReview.confidenceCol}</th>
                  <th className="py-2 text-start">{dict.reportsReview.sourcePage}</th>
                  <th className="py-2 text-start">Status</th>
                </tr>
              </thead>
              <tbody>
                {(document.extractedFields as unknown as ExtractedField[]).map((field) => (
                  <tr key={field.metricKey} className="border-b border-ink/5">
                    <td className="py-2">{field.labelEn}</td>
                    <td className="py-2">
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
                          className="metric-value w-28 rounded border border-ink/10 bg-surface-raised px-2 py-1"
                        />
                        <button type="submit" className="text-xs text-accent hover:underline">
                          {dict.reportsReview.save}
                        </button>
                      </form>
                    </td>
                    <td className="py-2 text-ink-muted">{Math.round(field.confidence * 100)}%</td>
                    <td className="py-2 text-ink-muted">{field.sourcePage ?? '—'}</td>
                    <td className="py-2">
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
            <p className="rounded-md border border-status-positive/40 bg-status-positive/10 p-3 text-sm text-status-positive">
              {dict.reportsReview.finalized}
            </p>
          ) : (
            <form
              action={finalizeReportAction.bind(null, locale, membership.hotelId, upload.id, document.id)}
              className="flex items-end gap-3 rounded-md border border-ink/10 p-4"
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
                  className="rounded border border-ink/10 bg-surface-raised px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm text-white">
                {dict.reportsReview.finalize}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
