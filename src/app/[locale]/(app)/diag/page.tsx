/**
 * TEMPORARY diagnostic route (production incident) — Test C: full shared
 * (app) layout (middleware + real auth + real membership lookup + real
 * notification count + AppShell), but zero page-specific database queries
 * of its own. Delete once the bottleneck is confirmed and fixed.
 */
export default function DiagPage() {
  return <div>diag-c ok {new Date().toISOString()}</div>;
}
