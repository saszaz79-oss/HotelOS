import type { ReactNode } from 'react';
import { Card } from './Card';
import { cn } from '@/lib/cn';

export type KpiTone = 'positive' | 'warning' | 'critical' | 'neutral';

const VALUE_TONE_CLASSES: Record<KpiTone, string> = {
  positive: 'text-status-positive',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
  neutral: 'text-ink',
};

const ICON_TONE_CLASSES: Record<KpiTone, string> = {
  positive: 'bg-status-positive/10 text-status-positive',
  warning: 'bg-status-warning/10 text-status-warning',
  critical: 'bg-status-critical/10 text-status-critical',
  neutral: 'bg-accent/10 text-accent',
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  tone?: KpiTone;
  icon?: ReactNode;
  trend?: ReactNode;
  className?: string;
}

/** Executive KPI card — the premium replacement for the ad-hoc `<Card><p/><p/></Card>` pattern each overview page previously hand-rolled. */
export function KpiCard({ label, value, tone = 'neutral', icon, trend, className }: KpiCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-ink-muted">{label}</p>
        {icon ? (
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', ICON_TONE_CLASSES[tone])} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn('metric-value mt-1 text-2xl font-semibold', VALUE_TONE_CLASSES[tone])}>{value}</p>
      {trend ? <div className="mt-1.5 text-xs text-ink-muted">{trend}</div> : null}
    </Card>
  );
}
