import type { ResolvedEvidenceItem } from '@/server/modules/insights/evidence';

/** Collapsed "why" behind a recommendation/alert — real HotelMetric values it was computed from, never a generic phrase with nothing underneath (Constitution truth test). Same native <details> pattern as admin/system's technical-details section — RTL-aware, no client JS. */
export function EvidenceDrawer({ items, toggleLabel, asOfLabel }: { items: ResolvedEvidenceItem[]; toggleLabel: string; asOfLabel: string }) {
  if (items.length === 0) return null;
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer text-xs text-accent marker:content-none hover:underline">
        <span className="inline-flex items-center gap-1.5">
          <svg viewBox="0 0 20 20" className="h-3 w-3 transition-transform group-open:rotate-90 rtl:group-open:-rotate-90" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path d="M7 4.5 12.5 10 7 15.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toggleLabel}
        </span>
      </summary>
      <ul className="mt-1.5 space-y-0.5 text-xs text-ink-muted">
        {items.map((item, i) => (
          <li key={i}>
            {item.label}: <span className="metric-value text-ink">{item.value}</span> ({asOfLabel} {item.metricDate})
          </li>
        ))}
      </ul>
    </details>
  );
}
