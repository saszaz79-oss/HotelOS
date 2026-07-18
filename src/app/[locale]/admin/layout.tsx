import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getDictionary, locales, defaultLocale, dirFor, type Locale } from '@/i18n/config';

/**
 * Super Admin Console (Product Owner directive: "Normal hotel users must
 * never access this area"). Unlike the Validation Workspace (D33,
 * English-only engineering tool), this IS product surface for the Platform
 * Owner — bilingual like the rest of HotelOS, since the Platform Owner may
 * well be an Arabic-first user (Constitution §8).
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user || !user.isSuperAdmin) {
    redirect(`/${locale}/mission-control`);
  }
  if (user.mustChangePassword) {
    redirect(`/${locale}/change-password`);
  }

  const dir = dirFor(locale);

  return (
    <div className="min-h-screen bg-surface" dir={dir}>
      <header className="border-b border-ink/10 bg-surface-raised px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{dict.admin.title}</p>
            <p className="text-xs text-ink-muted">{dict.admin.subtitle}</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link href={`/${locale}/admin/hotels`} className="hover:underline">
              {dict.admin.nav.hotels}
            </Link>
            <Link href={`/${locale}/admin/users`} className="hover:underline">
              {dict.admin.nav.users}
            </Link>
            <Link href={`/${locale}/admin/roles`} className="hover:underline">
              {dict.admin.nav.roles}
            </Link>
            <Link href={`/${locale}/admin/feature-flags`} className="hover:underline">
              {dict.admin.nav.featureFlags}
            </Link>
            <Link href={`/${locale}/admin/audit`} className="hover:underline">
              {dict.admin.nav.audit}
            </Link>
            <Link href={`/${locale}/admin/system`} className="hover:underline">
              {dict.admin.nav.system}
            </Link>
            <Link href={`/${locale}/admin/release-notes`} className="hover:underline">
              {dict.admin.nav.releaseNotes}
            </Link>
            <Link href={`/${locale}/admin/support`} className="hover:underline">
              {dict.admin.nav.support}
            </Link>
            <Link href={`/${locale}/admin/settings`} className="hover:underline">
              {dict.admin.nav.settings}
            </Link>
            <Link href={`/${locale}/mission-control`} className="text-ink-muted hover:underline">
              {dict.admin.exit}
            </Link>
          </nav>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
