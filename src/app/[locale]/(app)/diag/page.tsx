import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { trace } from '@/lib/perf-trace'; // TEMPORARY (production incident diagnostic)

/**
 * TEMPORARY diagnostic route (production incident) — Test C: full shared
 * (app) layout (middleware + real auth + real membership lookup + real
 * notification count + AppShell), but zero page-specific database queries
 * of its own. Delete once the bottleneck is confirmed and fixed.
 *
 * Re-calls getCurrentUser()/getActiveMembership() here deliberately — both
 * are React cache()-wrapped, so within this same request they return the
 * exact promise layout.tsx already resolved, at effectively zero extra
 * cost. Confirms the dedup is real while giving this page real data to
 * show, instead of adding a distinct query.
 */
export default async function DiagPage() {
  const __start = performance.now();
  const user = await getCurrentUser();
  const membership = user && !user.isSuperAdmin ? await getActiveMembership(user.id) : null;
  const ms = Math.round((performance.now() - __start) * 100) / 100;
  trace('page.diag-c.total', { ms });
  return (
    <div style={{ fontFamily: 'monospace', lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Diagnostic Route: diag-c (Test C)</h1>
      <p>Authentication used: YES (via shared layout)</p>
      <p>Database access used: YES (via shared layout: session + membership + notification count)</p>
      <p>Shared (app) layout: YES — same layout.tsx as every real page, including Mission Control</p>
      <p>Authenticated user: {user ? user.id : 'none'}</p>
      <p>Hotel: {membership ? membership.hotel.name : 'none / super admin'}</p>
      <p style={{ fontWeight: 'bold', marginTop: 16 }}>
        This page&apos;s own additional time on top of the layout: {ms}ms
      </p>
      <p style={{ marginTop: 16, color: '#666' }}>Rendered at {new Date().toISOString()}</p>
    </div>
  );
}
