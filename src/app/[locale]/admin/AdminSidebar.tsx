'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const COLLAPSE_STORAGE_KEY = 'hotelos-admin-sidebar-collapsed';

export interface AdminNavItem {
  href: string;
  label: string;
}

export function AdminSidebar({
  title,
  subtitle,
  navItems,
  exitLabel,
  signOutAction,
}: {
  title: string;
  subtitle: string;
  navItems: AdminNavItem[];
  exitLabel: string;
  /** A Server Action reference — Next.js allows passing these to Client Components as props and using them directly as a <form action>. */
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persisted across navigations/reloads (not just in-memory React state) —
  // "Collapsible, Persistent" per the Phase 3 spec.
  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === '1') setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col justify-between border-ink/10 bg-surface-raised p-4 md:border-e',
        collapsed ? 'md:w-[68px]' : 'md:w-64'
      )}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{title}</p>
              <p className="truncate text-xs text-ink-muted">{subtitle}</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            className="hidden shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-surface hover:text-ink md:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'block truncate rounded-md px-3 py-2 text-sm transition-colors',
                  active ? 'bg-primary text-white' : 'text-ink hover:bg-surface'
                )}
              >
                {collapsed ? item.label.slice(0, 1) : item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-ink-muted hover:text-ink">
          {collapsed ? null : exitLabel}
        </button>
      </form>
    </aside>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn('h-4 w-4 transition-transform rtl:scale-x-[-1]', collapsed && 'rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path d="M12.5 5 7 10l5.5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
