import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type StatusTone = 'positive' | 'warning' | 'critical' | 'info' | 'neutral';

const TONE_CLASSES: Record<StatusTone, string> = {
  positive: 'bg-status-positive/10 text-status-positive',
  warning: 'bg-status-warning/10 text-status-warning',
  critical: 'bg-status-critical/10 text-status-critical',
  info: 'bg-status-info/10 text-status-info',
  neutral: 'bg-ink/8 text-ink-muted',
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
}

/**
 * Presentational only — deliberately doesn't hardcode a status-string→tone
 * mapping (hotel status, report status, feature-flag state, and data-quality
 * validation status are four separate vocabularies with no shared meaning),
 * so each screen maps its own domain status to a tone at the call site.
 */
export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
