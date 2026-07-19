import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { AgentDefinition } from '@/server/modules/agents/registry';
import { logoutAction } from './actions';

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

/**
 * The Mission Control shell: navigation is rendered from the Agent Registry
 * (Architecture §13), not hardcoded — a newly-registered agent appears here
 * by registration, not by editing this file.
 */
export function AppShell({
  locale,
  dict,
  userDisplayName,
  hotelName,
  agents,
  children,
}: {
  locale: Locale;
  dict: Dict;
  userDisplayName: string;
  hotelName: string | null;
  agents: AgentDefinition[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between border-ink/10 bg-surface-raised p-4 md:w-60 md:border-e">
        <div className="space-y-6">
          <div>
            <p className="text-sm text-ink-muted">{hotelName ?? '—'}</p>
            <p className="text-xs text-ink-muted">{userDisplayName}</p>
          </div>
          <nav className="space-y-1">
            <Link
              href={`/${locale}/mission-control`}
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
            >
              {dict.nav.missionControl}
            </Link>
            <Link
              href={`/${locale}/reports/upload`}
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
            >
              {dict.nav.reports}
            </Link>
            <Link
              href={`/${locale}/reports/archive`}
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
            >
              {dict.nav.archive}
            </Link>
            <Link
              href={`/${locale}/timeline`}
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
            >
              {dict.nav.timeline}
            </Link>
            {agents
              .filter((a) => a.id !== 'executive-agent')
              .map((agent) => (
                <span
                  key={agent.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink-muted"
                  title={agent.status === 'coming_soon' ? dict.nav.comingSoon : undefined}
                >
                  {locale === 'ar' ? agent.nameAr : agent.nameEn}
                  {agent.status === 'coming_soon' ? (
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px]">
                      {dict.nav.comingSoon}
                    </span>
                  ) : null}
                </span>
              ))}
          </nav>
        </div>
        <form
          action={async () => {
            'use server';
            await logoutAction(locale);
          }}
        >
          <button type="submit" className="text-sm text-ink-muted hover:text-ink">
            {locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
          </button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
