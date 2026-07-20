import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { logoutAction } from '../(app)/actions';
import { getDictionary, locales, defaultLocale, dirFor, type Locale } from '@/i18n/config';
import { AdminSidebar, type AdminNavItem } from './AdminSidebar';
import { countUnreadNotifications } from '@/server/modules/notifications/queries';

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

  // Subscriptions/Licenses is intentionally not listed yet — that module
  // doesn't exist until Phase 13 (Enterprise v2 working method: hide
  // incomplete features rather than show a broken/placeholder nav entry).
  const navItems: AdminNavItem[] = [
    { href: `/${locale}/admin`, label: dict.admin.nav.overview },
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

  const initialUnreadCount = await countUnreadNotifications(user.id);

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row" dir={dir}>
      <AdminSidebar
        locale={locale}
        title={dict.admin.title}
        subtitle={dict.admin.subtitle}
        navItems={navItems}
        exitLabel={dict.admin.exit}
        signOutAction={logoutAction.bind(null, locale)}
        notificationsDict={dict.notifications}
        initialUnreadCount={initialUnreadCount}
      />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
