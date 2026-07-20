'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NotificationBell } from '../(app)/NotificationBell';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Locale } from '@/i18n/config';

const COLLAPSE_STORAGE_KEY = 'hotelos-admin-sidebar-collapsed';

export interface AdminNavItem {
  href: string;
  label: string;
}

interface NotificationsDict {
  title: string;
  empty: string;
  markAllRead: string;
  unreadBadge: string;
}

export function AdminSidebar({
  locale,
  title,
  subtitle,
  navItems,
  exitLabel,
  signOutAction,
  notificationsDict,
  initialUnreadCount,
  themeLabels,
}: {
  locale: Locale;
  title: string;
  subtitle: string;
  navItems: AdminNavItem[];
  exitLabel: string;
  /** A Server Action reference — Next.js allows passing these to Client Components as props and using them directly as a <form action>. */
  signOutAction: () => Promise<void>;
  notificationsDict: NotificationsDict;
  initialUnreadCount: number;
  themeLabels: { light: string; dark: string };
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
        'flex shrink-0 flex-col justify-between border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-4 backdrop-blur-xl transition-[width] duration-300 ease-out md:border-e',
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
            className="hidden shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink md:block"
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
                  'relative block truncate rounded-md px-3 py-2 text-sm transition-all duration-200',
                  active
                    ? 'bg-primary text-white shadow-[0_2px_12px_-2px_hsl(var(--glow-accent))]'
                    : 'text-ink hover:translate-x-0.5 hover:bg-surface rtl:hover:-translate-x-0.5'
                )}
              >
                {collapsed ? item.label.slice(0, 1) : item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className={cn('space-y-3', collapsed && 'flex flex-col items-center')}>
        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          <NotificationBell locale={locale} dict={notificationsDict} initialUnreadCount={initialUnreadCount} />
          <ThemeToggle labels={themeLabels} />
        </div>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-ink-muted transition-colors hover:text-ink">
            {collapsed ? null : exitLabel}
          </button>
        </form>
      </div>
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
