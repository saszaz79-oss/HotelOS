import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Shimmer placeholder — pairs with the `.skeleton` keyframes in globals.css, which fall back to a static tint under prefers-reduced-motion. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden="true" {...props} />;
}
