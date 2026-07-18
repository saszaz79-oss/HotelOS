import { getQualityDashboardStats } from '@/server/modules/validation/queries';

export default async function QualityDashboardPage() {
  const stats = await getQualityDashboardStats();

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-lg font-medium">Data Quality Dashboard</h1>
        <p className="text-sm text-ink-muted">
          Computed from {stats.totalReports} processed report{stats.totalReports === 1 ? '' : 's'}. Every number below
          is real — with zero reports processed, this page correctly shows zeros rather than placeholder data.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total reports" value={stats.totalReports} />
        <Stat label="With ground truth" value={stats.reportsWithGroundTruth} />
        <Stat label="With parser warnings" value={stats.reportsWithParserWarnings} />
        <Stat label="Manually corrected metrics" value={stats.manualCorrectionsCount} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Reports by Type</h2>
        <Table rows={stats.byReportType.map((r) => [r.reportType, r.count])} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Normalization / Validation Status</h2>
        <Table rows={stats.byValidationStatus.map((r) => [r.status, r.count])} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Confidence Distribution</h2>
        <Table rows={stats.confidenceBuckets.map((r) => [r.bucket, r.count])} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">Completeness Distribution</h2>
        <Table rows={stats.completenessBuckets.map((r) => [r.bucket, r.count])} />
      </section>

      <p className="text-xs text-ink-muted">
        Not yet tracked (Validation Phase, known limitation — see docs/VALIDATION_REPORT.md): duplicate-upload attempt
        volume (rejected duplicates are not persisted in v0.1) and unknown/unmapped field names (the current adapter
        only ever emits canonical metric keys, so this category has no data to show yet).
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-ink/10 p-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="metric-value text-xl font-semibold">{value}</div>
    </div>
  );
}

function Table({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-ink-muted">No data yet.</p>;
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {rows.map(([label, count]) => (
          <tr key={label} className="border-b border-ink/5">
            <td className="py-1">{label}</td>
            <td className="py-1 metric-value">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
