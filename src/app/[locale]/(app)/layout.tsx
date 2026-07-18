import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { listAgentsForRole } from '@/server/modules/agents/registry';
import { AppShell } from './AppShell';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
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
  const membership = user.isSuperAdmin
    ? null
    : await prisma.hotelMembership.findFirst({
        where: { userId: user.id, status: 'active' },
        include: { hotel: true },
      });

  const agents = membership ? listAgentsForRole(membership.role) : [];

  return (
    <AppShell
      locale={locale}
      dict={dict}
      userDisplayName={user.displayName}
      hotelName={membership?.hotel.name ?? null}
      agents={agents}
    >
      {children}
    </AppShell>
  );
}
