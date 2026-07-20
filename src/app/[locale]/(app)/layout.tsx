import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listAgentsForRole } from '@/server/modules/agents/registry';
import { countUnreadNotifications } from '@/server/modules/notifications/queries';
import { AppShell } from './AppShell';
import { logoutAction } from './actions';

export default async function AppLayout(
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
  if (user.mustChangePassword) {
    redirect(`/${locale}/change-password`);
  }

  // v0.1 M1: first active membership stands in for a full hotel switcher,
  // which is planned but not yet built (UX_SYSTEM.md §1 hotel switcher).
  const membership = user.isSuperAdmin ? null : await getActiveMembership(user.id);

  const agents = membership ? listAgentsForRole(membership.role) : [];
  const initialUnreadCount = await countUnreadNotifications(user.id);

  return (
    <AppShell
      locale={locale}
      dict={dict}
      userDisplayName={user.displayName}
      hotelName={membership?.hotel.name ?? null}
      agents={agents}
      exitLabel={dict.app.signOut}
      signOutAction={logoutAction.bind(null, locale)}
      initialUnreadCount={initialUnreadCount}
    >
      {children}
    </AppShell>
  );
}
