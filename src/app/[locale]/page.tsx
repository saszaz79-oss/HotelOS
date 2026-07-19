import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import type { Locale } from '@/i18n/config';

// Resolves the final destination directly instead of always bouncing
// through /mission-control (which itself redirects unauthenticated visitors
// to /login and Super Admins to /admin) — saves a redirect hop on every
// visit to the bare locale root.
export default async function LocaleIndexPage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  const locale = params.locale;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }
  if (user.mustChangePassword) {
    redirect(`/${locale}/change-password`);
  }
  redirect(`/${locale}/${user.isSuperAdmin ? 'admin' : 'mission-control'}`);
}
