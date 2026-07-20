import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Gold accent stays the product's one CTA color (already live on every
  // existing screen via bg-accent) — new and redesigned screens share it
  // rather than introducing a second, inconsistent "primary button" color
  // mid-migration. Deep navy (bg-primary) is reserved for large brand
  // surfaces (sidebars, headers), not buttons — see globals.css comment.
  primary:
    'bg-accent text-white shadow-[0_2px_10px_-2px_hsl(var(--glow-accent))] hover:bg-accent-hover hover:shadow-[0_4px_18px_-2px_hsl(var(--glow-accent))]',
  secondary: 'border border-ink/15 bg-surface-raised text-ink hover:bg-surface',
  ghost: 'text-ink-muted hover:bg-surface hover:text-ink',
  danger: 'bg-status-critical text-white hover:opacity-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  icon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : (
        icon
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
