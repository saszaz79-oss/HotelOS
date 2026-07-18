import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

/**
 * Validation Workspace (Validation Phase §1) — an internal engineering
 * tool, gated to Super Admin only, deliberately outside the hotel-scoped
 * Mission Control shell (Architecture §27: this belongs to no hotel's
 * bounded context, it spans all of them). English-only by design: unlike
 * the hotel-facing product (Constitution §8 bilingual requirement), this
 * surface is never shown to a hotel user, so bilingual investment here
 * would not serve the product's actual Arabic-first audience.
 */
export default async function ValidationLayout(
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
  const user = await getCurrentUser();

  if (!user || !user.isSuperAdmin) {
    redirect(`/${locale}/mission-control`);
  }

  return (
    <div className="min-h-screen bg-surface" dir="ltr">
      <header className="border-b border-ink/10 bg-surface-raised px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">HotelOS Validation Workspace</p>
            <p className="text-xs text-ink-muted">Internal engineering tool — not part of the hotel-facing product</p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href={`/${locale}/validation`} className="hover:underline">
              Reports
            </Link>
            <Link href={`/${locale}/validation/quality`} className="hover:underline">
              Quality Dashboard
            </Link>
            <Link href={`/${locale}/mission-control`} className="text-ink-muted hover:underline">
              Exit
            </Link>
          </nav>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
