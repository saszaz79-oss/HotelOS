export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * Hand-rolled SVG line chart — no charting dependency. Only ever plots
 * points it was actually given; a date with no HotelMetric row for this
 * key is simply absent from `points`, never interpolated or zero-filled
 * (Enterprise v2 rule: no fabricated data).
 */
export function TrendChart({
  points,
  formatValue,
  formatDate,
  emptyLabel,
  height = 220,
}: {
  points: TrendPoint[];
  formatValue: (v: number) => string;
  formatDate: (iso: string) => string;
  emptyLabel: string;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-ink/15 text-sm text-ink-muted"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const width = 600;
  const padding = { top: 16, right: 16, bottom: 28, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Guard against a flat series (max === min, including a single point) —
  // without this the y-scale divides by zero and every point collapses to
  // the same pixel.
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;

  const xFor = (i: number) => (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const yFor = (v: number) => plotHeight - ((v - min) / (max - min)) * plotHeight;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(' ');

  // Show at most ~6 x-axis labels regardless of point count, so a 30-day
  // range doesn't collide into unreadable overlapping text.
  const labelStride = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="hsl(var(--ink) / 0.1)" strokeWidth={1} />
        <path d={linePath} fill="none" stroke="hsl(var(--accent))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r={3} fill="hsl(var(--accent))">
              <title>
                {formatDate(p.date)}: {formatValue(p.value)}
              </title>
            </circle>
            {i % labelStride === 0 || i === points.length - 1 ? (
              <text x={xFor(i)} y={plotHeight + 18} fontSize={10} fill="hsl(var(--ink) / 0.55)" textAnchor="middle">
                {formatDate(p.date)}
              </text>
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );
}
