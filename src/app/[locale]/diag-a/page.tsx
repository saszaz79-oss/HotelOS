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
  const ms = Math.round((performance.now() - __start) * 100) / 100;
  trace('page.diag-a.total', { ms });
  return (
    <div style={{ fontFamily: 'monospace', padding: 32, maxWidth: 640, lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Diagnostic Route: diag-a (Test A)</h1>
      <p>Locale: {locale}</p>
      <p>Authentication used: NO</p>
      <p>Database access used: NO</p>
      <p>Shared (app) layout: NO</p>
      <p style={{ fontWeight: 'bold', marginTop: 16 }}>Server render time: {ms}ms</p>
      <p style={{ marginTop: 16, color: '#666' }}>Rendered at {new Date().toISOString()}</p>
    </div>
  );
}
