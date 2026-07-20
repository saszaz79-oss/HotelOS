'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'hotelos-theme';

/**
 * Reads the class the no-FOUC inline script (root layout) may have already
 * applied; falls back to OS preference so the icon matches what's actually
 * rendered on first paint instead of defaulting to light.
 */
function readIsDark(): boolean {
  const root = document.documentElement;
  if (root.classList.contains('dark')) return true;
  if (root.classList.contains('light')) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeToggle({ className, labels }: { className?: string; labels: { light: string; dark: string } }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(readIsDark());
  }, []);

  function toggle() {
    setIsDark((prev) => {
      const next = !prev;
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(next ? 'dark' : 'light');
      window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isDark === null}
      aria-label={isDark ? labels.light : labels.dark}
      title={isDark ? labels.light : labels.dark}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink',
        className
      )}
    >
      {isDark === null ? null : isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" />
      <path
        strokeLinecap="round"
        d="M10 2.5v1.5M10 16v1.5M4 10H2.5M17.5 10H16M5.5 5.5 4.4 4.4M15.6 15.6l-1.1-1.1M14.5 5.5l1.1-1.1M4.4 15.6l1.1-1.1"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M17.3 12.5a7 7 0 0 1-9.8-9.8 7.5 7.5 0 1 0 9.8 9.8Z" />
    </svg>
  );
}
