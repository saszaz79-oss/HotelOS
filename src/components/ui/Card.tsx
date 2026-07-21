import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Glassmorphic surface — every screen already imports this, so the premium visual pass lands everywhere at once. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-5',
        'shadow-[0_1px_2px_hsl(var(--shadow-color)/0.06),0_12px_32px_-16px_hsl(var(--shadow-color)/0.35)]',
        'transition-shadow duration-300',
        'hover:shadow-[0_1px_2px_hsl(var(--shadow-color)/0.08),0_18px_44px_-16px_hsl(var(--shadow-color)/0.45)]',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex items-center justify-between', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-sm font-medium tracking-wide text-ink-muted', className)} {...props} />;
}
