import Link from 'next/link';
import { locales, defaultLocale, type Locale } from '@/i18n/config';
import { listReportsForValidation } from '@/server/modules/validation/queries';

export default async function ValidationReportsPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const docs = await listReportsForValidation(200);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">Uploaded Reports — Extraction & Validation Status</h1>
      {docs.length === 0 ? (
        <p className="text-sm text-ink-muted">No reports have been processed yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-start text-ink-muted">
              <th className="py-2 text-start">Hotel</th>
              <th className="py-2 text-start">File</th>
              <th className="py-2 text-start">Report Type</th>
              <th className="py-2 text-start">Parsing Status</th>
              <th className="py-2 text-start">Validation Status</th>
              <th className="py-2 text-start">Completeness</th>
              <th className="py-2 text-start">Confidence</th>
              <th className="py-2 text-start">Ground Truth</th>
              <th className="py-2 text-start">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-ink/5">
                <td className="py-2">{d.reportUpload.hotel.name}</td>
                <td className="py-2">
                  <Link href={`/${locale}/validation/${d.id}`} className="text-accent hover:underline">
                    {d.reportUpload.originalFilename}
                  </Link>
                </td>
                <td className="py-2">{d.reportType}</td>
                <td className="py-2">{d.extractionJobs[0]?.stage ?? '—'}</td>
                <td className="py-2">{d.validationStatus ?? '—'}</td>
                <td className="py-2 metric-value">{d.completenessScore !== null ? `${Math.round(d.completenessScore * 100)}%` : '—'}</td>
                <td className="py-2 metric-value">{d.extractionConfidence !== null ? `${Math.round(d.extractionConfidence * 100)}%` : '—'}</td>
                <td className="py-2">{d.groundTruth ? 'recorded' : '—'}</td>
                <td className="py-2 text-ink-muted">{new Date(d.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
