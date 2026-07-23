import { locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { trace } from '@/lib/perf-trace'; // TEMPORARY (production incident diagnostic)

/**
 * TEMPORARY diagnostic route (production incident) — Test B: middleware +
 * real authentication (real Session DB lookup via getCurrentUser()), zero
 * shared layout, zero page-specific queries beyond that. Delete once the
 * bottleneck is confirmed and fixed.
 */
export default async function DiagBPage(props: { params: Promise<{ locale: string }> }) {
  const __start = performance.now();
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const user = await getCurrentUser();
  trace('page.diag-b.total', { ms: Math.round((performance.now() - __start) * 100) / 100 });
  return (
    <div>
      diag-b ok {locale} {new Date().toISOString()} user={user ? user.id : 'none'}
    </div>
  );
}
