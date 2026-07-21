import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Glass container for data tables — pairs with plain <table>/<thead>/<tbody> markup in each page (the row/column shape differs too much per page to abstract further). */
export function TableShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]',
        'shadow-[0_1px_2px_hsl(var(--shadow-color)/0.06),0_12px_32px_-16px_hsl(var(--shadow-color)/0.35)]',
        className
      )}
      {...props}
    />
  );
}

export const tableHeadRowClass = 'border-b border-[hsl(var(--glass-border))] text-start';
export const tableHeadCellClass = 'px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-ink-muted';
export const tableRowClass = 'border-b border-[hsl(var(--glass-border))] transition-colors last:border-0 hover:bg-ink/[0.02]';
export const tableCellClass = 'px-4 py-3';
