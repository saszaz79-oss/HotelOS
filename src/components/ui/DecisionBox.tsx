import type { ReactNode } from 'react';
import { Card } from './Card';
import { StatusBadge, type StatusTone } from './StatusBadge';
import { cn } from '@/lib/cn';

const TINT_TONE_CLASSES: Record<StatusTone, string> = {
  positive: 'bg-status-positive/5 ring-1 ring-inset ring-status-positive/15',
  warning: 'bg-status-warning/5 ring-1 ring-inset ring-status-warning/15',
  critical: 'bg-status-critical/5 ring-1 ring-inset ring-status-critical/15',
  info: 'bg-status-info/5 ring-1 ring-inset ring-status-info/15',
  neutral: 'ring-1 ring-inset ring-ink/10',
};

export interface DecisionBoxProps {
  tone: StatusTone;
  kindLabel: string;
  title: string;
  whyItMattersLabel: string;
  whyItMatters: string;
  businessImpactLabel: string;
  businessImpact: string;
  recommendedActionLabel: string;
  recommendedAction: string;
  confidenceLabel: string;
  confidenceValue: string;
  badges?: ReactNode;
  evidence?: ReactNode;
  className?: string;
}

/**
 * Executive Decision Box (Executive Decision Intelligence redesign, Phase 4)
 * — a structured card for one classified finding: why it matters, its
 * business impact, the recommended action, and how confident the
 * classification is. Presentational only, same convention as StatusBadge —
 * `tone`/labels/values are all resolved by the caller (reports/export's
 * decisionBoxKindTone + classification.ts's decisionBoxKind) so this
 * component carries no domain logic and no server-module imports.
 */
export function DecisionBox({
  tone,
  kindLabel,
  title,
  whyItMattersLabel,
  whyItMatters,
  businessImpactLabel,
  businessImpact,
  recommendedActionLabel,
  recommendedAction,
  confidenceLabel,
  confidenceValue,
  badges,
  evidence,
  className,
}: DecisionBoxProps) {
  return (
    <Card className={cn('space-y-2.5 p-4', TINT_TONE_CLASSES[tone], className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge tone={tone}>{kindLabel}</StatusBadge>
        {badges}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <dl className="space-y-1.5 text-xs">
        <div>
          <dt className="text-ink-muted">{whyItMattersLabel}</dt>
          <dd className="text-ink">{whyItMatters}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{businessImpactLabel}</dt>
          <dd className="text-ink">{businessImpact}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{recommendedActionLabel}</dt>
          <dd className="text-ink">{recommendedAction}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-xs text-ink-muted">
        <span>
          {confidenceLabel}: <span className="metric-value text-ink">{confidenceValue}</span>
        </span>
        {evidence}
      </div>
    </Card>
  );
}
