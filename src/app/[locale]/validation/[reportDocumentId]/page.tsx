import { locales, defaultLocale, type Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { getReportValidationDetail } from '@/server/modules/validation/queries';
import { compareExtractionAccuracy } from '@/server/modules/validation/commands';
import type { ExtractedField } from '@/server/modules/report-extraction/types';
import type { QualityNote } from '@/server/modules/report-extraction/data-quality';
import { recordGroundTruthAction } from './actions';

export default async function ValidationReportDetailPage(
  props: {
    params: Promise<{ locale: string; reportDocumentId: string }>;
  }
) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const doc = await getReportValidationDetail(params.reportDocumentId);

  if (!doc) return <p className="text-sm text-ink-muted">Not found.</p>;

  const fields = doc.extractedFields as unknown as ExtractedField[];
  const notes = doc.qualityNotes as unknown as QualityNote[];
  const warnings = doc.parserWarnings as unknown as string[];

  // AI Readiness (Validation Phase §1): can the Executive AI Summary
  // actually ground itself in this report's data?
  const aiProviderConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasFinalizedMetrics = doc.metrics.length > 0;

  // Decision Engine Readiness (Validation Phase §1): has this date's
  // Insight/Alerts/Recommendations actually been computed?
  const insight = doc.confirmedReportDate
    ? await prisma.insight.findUnique({
        where: { hotelId_insightDate: { hotelId: doc.hotelId, insightDate: doc.confirmedReportDate } },
      })
    : null;

  const accuracy = doc.groundTruth ? await compareExtractionAccuracy(doc.id) : null;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-lg font-medium">{doc.reportUpload.originalFilename}</h1>
        <p className="text-sm text-ink-muted">
          {doc.reportUpload.hotel.name} · {doc.reportType} · uploaded by {doc.reportUpload.uploadedBy.displayName}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 rounded-md border border-ink/10 p-4 text-sm sm:grid-cols-4">
        <div>
          <div className="text-ink-muted">Completeness</div>
          <div className="metric-value">{doc.completenessScore !== null ? `${Math.round(doc.completenessScore * 100)}%` : '—'}</div>
        </div>
        <div>
          <div className="text-ink-muted">Type confidence</div>
          <div className="metric-value">{doc.extractionConfidence !== null ? `${Math.round(doc.extractionConfidence * 100)}%` : '—'}</div>
        </div>
        <div>
          <div className="text-ink-muted">Validation status</div>
          <div>{doc.validationStatus ?? '—'}</div>
        </div>
        <div>
          <div className="text-ink-muted">Confirmed date</div>
          <div>{doc.confirmedReportDate ? new Date(doc.confirmedReportDate).toLocaleDateString() : 'not finalized'}</div>
        </div>
        <div>
          <div className="text-ink-muted">AI Readiness</div>
          <div className={aiProviderConfigured && hasFinalizedMetrics ? 'text-status-positive' : 'text-status-warning'}>
            {!aiProviderConfigured ? 'No AI provider configured' : hasFinalizedMetrics ? 'Ready' : 'No finalized metrics yet'}
          </div>
        </div>
        <div>
          <div className="text-ink-muted">Decision Engine Readiness</div>
          <div className={insight ? 'text-status-positive' : 'text-status-warning'}>
            {insight ? `Insight computed (score ${insight.healthScore})` : 'Not computed yet'}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Extraction Results</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-start text-ink-muted">
              <th className="py-2 text-start">Field</th>
              <th className="py-2 text-start">Extracted Value</th>
              <th className="py-2 text-start">Original Text</th>
              <th className="py-2 text-start">Confidence</th>
              <th className="py-2 text-start">Page</th>
              <th className="py-2 text-start">Status</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.metricKey} className="border-b border-ink/5">
                <td className="py-2">{f.labelEn}</td>
                <td className="py-2 metric-value">{f.value ?? '—'}</td>
                <td className="py-2 text-xs text-ink-muted">{f.sourceSnippet ?? f.rawText ?? '—'}</td>
                <td className="py-2 metric-value">{Math.round(f.confidence * 100)}%</td>
                <td className="py-2">{f.sourcePage ?? '—'}</td>
                <td className="py-2">{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {notes.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-ink-muted">Quality Notes</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {notes.map((n, i) => (
              <li key={i} className="text-status-warning">
                [{n.issue}] {n.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-ink-muted">Parser Warnings</h2>
          <ul className="mt-2 space-y-1 text-sm text-status-warning">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Manual Corrections</h2>
        {doc.metrics.filter((m) => m.isManuallyCorrected).length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">None recorded for this report&apos;s normalized metrics.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {doc.metrics
              .filter((m) => m.isManuallyCorrected)
              .map((m) => (
                <li key={m.id}>
                  {m.metricKey}: {m.value}
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-ink/10 p-4">
        <h2 className="text-sm font-medium text-ink-muted">Real Data Mode — Ground Truth &amp; Accuracy</h2>
        {accuracy ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="metric-value text-lg font-semibold">{Math.round(accuracy.accuracy * 100)}% accuracy</p>
            <p className="text-ink-muted">
              {accuracy.matches} match · {accuracy.mismatches} mismatch · {accuracy.falsePositives} false positive ·{' '}
              {accuracy.falseNegatives} false negative
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-ink-muted">
                  <th className="py-1 text-start">Field</th>
                  <th className="py-1 text-start">Expected</th>
                  <th className="py-1 text-start">Extracted</th>
                  <th className="py-1 text-start">Result</th>
                </tr>
              </thead>
              <tbody>
                {accuracy.comparisons.map((c) => (
                  <tr key={c.metricKey} className="border-b border-ink/5">
                    <td className="py-1">{c.metricKey}</td>
                    <td className="py-1 metric-value">{c.expected ?? '—'}</td>
                    <td className="py-1 metric-value">{c.extracted ?? '—'}</td>
                    <td className={'py-1 ' + (c.result === 'match' ? 'text-status-positive' : 'text-status-critical')}>{c.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              No ground truth recorded — accuracy for this specific report is unmeasured. Enter expected values from the
              source PDF to measure parser accuracy against this real report.
            </p>
            <form action={recordGroundTruthAction.bind(null, locale, doc.id)} className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {fields.map((f) => (
                  <div key={f.metricKey} className="space-y-1">
                    <label className="block text-xs text-ink-muted">{f.labelEn}</label>
                    <input
                      type="number"
                      step="any"
                      name={`expected__${f.metricKey}`}
                      className="w-full rounded border border-ink/10 bg-surface-raised px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
              <textarea
                name="notes"
                placeholder="Notes (e.g. which page of the PDF you verified against)"
                className="w-full rounded border border-ink/10 bg-surface-raised px-2 py-1 text-sm"
              />
              <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm text-white">
                Save ground truth
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
