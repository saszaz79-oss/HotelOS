'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import type { Locale } from '@/i18n/config';
import type { AgentDefinition } from '@/server/modules/agents/registry';

interface Dict {
  nav: {
    missionControl: string;
    timeline: string;
    comparisons: string;
    archive: string;
    askAI: string;
    reports: string;
    comingSoon: string;
  };
}

const COLLAPSE_STORAGE_KEY = 'hotelos-app-sidebar-collapsed';

/**
 * The Mission Control shell: navigation is rendered from the Agent Registry
 * (Architecture §13), not hardcoded — a newly-registered agent appears here
 * by registration, not by editing this file. Agents with status
 * 'coming_soon' are never rendered here (Enterprise v2 rule: incomplete
 * features stay hidden, not shown as a disabled/"coming soon" control).
 */
export function AppShell({
  locale,
  dict,
  userDisplayName,
  hotelName,
  agents,
  exitLabel,
  signOutAction,
  children,
}: {
  locale: Locale;
  dict: Dict;
  userDisplayName: string;
  hotelName: string | null;
  agents: AgentDefinition[];
  exitLabel: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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

  const currentPath = pathname?.replace(/^\/(ar|en)/, '') || '/mission-control';

  const navItems = [
    { href: `/${locale}/mission-control`, label: dict.nav.missionControl },
    { href: `/${locale}/reports/upload`, label: dict.nav.reports },
    { href: `/${locale}/reports/archive`, label: dict.nav.archive },
    { href: `/${locale}/timeline`, label: dict.nav.timeline },
  ];

  const liveAgents = agents.filter((a) => a.status === 'live' && a.id !== 'executive-agent');

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
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
                <p className="truncate text-sm font-semibold text-ink">HotelOS</p>
                <p className="truncate text-xs text-ink-muted">{hotelName ?? '—'}</p>
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
              const active = currentPath === item.href.replace(`/${locale}`, '');
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
            {liveAgents.map((agent) => (
              <span
                key={agent.id}
                className="block truncate rounded-md px-3 py-2 text-sm text-ink-muted"
              >
                {collapsed ? (locale === 'ar' ? agent.nameAr : agent.nameEn).slice(0, 1) : locale === 'ar' ? agent.nameAr : agent.nameEn}
              </span>
            ))}
          </nav>
        </div>

        <div className={cn('space-y-3', collapsed && 'flex flex-col items-center')}>
          {collapsed ? null : (
            <>
              <LanguageSwitch locale={locale} path={currentPath} />
              <p className="truncate text-xs text-ink-muted">{userDisplayName}</p>
            </>
          )}
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-ink-muted hover:text-ink">
              {collapsed ? null : exitLabel}
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
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
