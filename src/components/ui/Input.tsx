'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const baseFieldClasses =
  'w-full rounded-md border border-ink/15 bg-surface-raised px-3 py-2.5 text-sm text-ink ' +
  'placeholder:text-ink-muted/70 transition-colors ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

/** Text/email/number/etc. input with label + error state — password fields should use PasswordInput below for the show/hide toggle. */
export function Input({ label, error, id, className, ...props }: InputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={fieldId}
        className={cn(baseFieldClasses, error && 'border-status-critical focus:border-status-critical focus:ring-status-critical/30', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-xs text-status-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  showLabel?: string;
  hideLabel?: string;
}

/** Password input with a show/hide toggle — kept a separate component from Input rather than an overloaded `type` prop, since the toggle button changes the markup shape (relative wrapper + absolutely-positioned button). */
export function PasswordInput({
  label,
  error,
  id,
  className,
  showLabel = 'Show',
  hideLabel = 'Hide',
  ...props
}: PasswordInputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className={cn(baseFieldClasses, 'pe-16', error && 'border-status-critical focus:border-status-critical focus:ring-status-critical/30', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 end-0 flex items-center px-3 text-xs font-medium text-ink-muted hover:text-ink"
          tabIndex={-1}
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-xs text-status-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}
