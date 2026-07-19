import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { logoutAction } from '../(app)/actions';
import { getDictionary, locales, defaultLocale, dirFor, type Locale } from '@/i18n/config';

/**
 * Super Admin Console (Product Owner directive: "Normal hotel users must
 * never access this area"). Unlike the Validation Workspace (D33,
 * English-only engineering tool), this IS product surface for the Platform
 * Owner — bilingual like the rest of HotelOS, since the Platform Owner may
 * well be an Arabic-first user (Constitution §8).
 */
export default async function AdminLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }
  if (!user.isSuperAdmin) {
    redirect(`/${locale}/mission-control`);
  }
  if (user.mustChangePassword) {
    redirect(`/${locale}/change-password`);
  }

  const dir = dirFor(locale);

  const navItems: { href: string; label: string }[] = [
    { href: `/${locale}/admin/hotels`, label: dict.admin.nav.hotels },
    { href: `/${locale}/admin/users`, label: dict.admin.nav.users },
    { href: `/${locale}/admin/roles`, label: dict.admin.nav.roles },
    { href: `/${locale}/admin/feature-flags`, label: dict.admin.nav.featureFlags },
    { href: `/${locale}/admin/audit`, label: dict.admin.nav.audit },
    { href: `/${locale}/admin/system`, label: dict.admin.nav.system },
    { href: `/${locale}/admin/release-notes`, label: dict.admin.nav.releaseNotes },
    { href: `/${locale}/admin/support`, label: dict.admin.nav.support },
    { href: `/${locale}/admin/settings`, label: dict.admin.nav.settings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row" dir={dir}>
      {/* Sidebar, matching the hotel workspace's AppShell pattern (M8: the
          previous top horizontal nav crammed 9 links + sign-out into one
          flex-wrap row — cramped on any real viewport and the first thing
          this audit's "no tiny horizontal navigation" note was written
          about). */}
      <aside className="flex shrink-0 flex-col justify-between border-ink/10 bg-surface-raised p-4 md:w-64 md:border-e">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium">{dict.admin.title}</p>
            <p className="text-xs text-ink-muted">{dict.admin.subtitle}</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form
          action={async () => {
            'use server';
            await logoutAction(locale);
          }}
        >
          {/* The Platform Owner (isSuperAdmin) never has a HotelMembership
              by design, so there is no hotel-facing area to "exit" into —
              linking to /mission-control just bounced straight back here
              (mission-control redirects Super Admins to /admin). A real
              sign-out is the only meaningful action here. */}
          <button type="submit" className="text-sm text-ink-muted hover:text-ink">
            {dict.admin.exit}
          </button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
