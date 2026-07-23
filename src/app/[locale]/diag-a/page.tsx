import { locales, defaultLocale, type Locale } from '@/i18n/config';
import { trace } from '@/lib/perf-trace'; // TEMPORARY (production incident diagnostic)

/**
 * TEMPORARY diagnostic route (production incident) — Test A: middleware +
 * routing only. Zero auth check, zero DB, zero shared layout. Delete once
 * the bottleneck is confirmed and fixed.
 */
export default async function DiagAPage(props: { params: Promise<{ locale: string }> }) {
  const __start = performance.now();
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  trace('page.diag-a.total', { ms: Math.round((performance.now() - __start) * 100) / 100 });
  return <div>diag-a ok {locale} {new Date().toISOString()}</div>;
}
