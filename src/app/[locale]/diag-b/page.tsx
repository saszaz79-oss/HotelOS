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
  const __authStart = performance.now();
  const user = await getCurrentUser();
  const authMs = Math.round((performance.now() - __authStart) * 100) / 100;
  const ms = Math.round((performance.now() - __start) * 100) / 100;
  trace('page.diag-b.total', { ms });
  return (
    <div style={{ fontFamily: 'monospace', padding: 32, maxWidth: 640, lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Diagnostic Route: diag-b (Test B)</h1>
      <p>Locale: {locale}</p>
      <p>Authentication used: YES (real Session table lookup)</p>
      <p>Database access used: YES (1 query)</p>
      <p>Shared (app) layout: NO</p>
      <p>Authenticated user: {user ? user.id : 'none (no valid session)'}</p>
      <p style={{ fontWeight: 'bold', marginTop: 16 }}>Session lookup time: {authMs}ms</p>
      <p style={{ fontWeight: 'bold' }}>Total server render time: {ms}ms</p>
      <p style={{ marginTop: 16, color: '#666' }}>Rendered at {new Date().toISOString()}</p>
    </div>
  );
}
