/**
 * Automatically wraps every page under (app) in a Suspense boundary
 * (Next.js `loading.tsx` convention) — the AppShell layout (sidebar/nav)
 * still renders immediately since layouts sit outside this boundary; only
 * the page content area shows this fallback while its data fetches.
 * Added during the M7 performance audit: production requests here can take
 * several seconds end-to-end (Vercel cold start + first pooled connection
 * to Supabase), and with no loading state the UI looked frozen for that
 * whole window.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink/60" />
        <span>Loading… · جارٍ التحميل</span>
      </div>
    </div>
  );
}
