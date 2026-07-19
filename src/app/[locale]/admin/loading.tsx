/** Same rationale as (app)/loading.tsx — see that file's comment. */
export default function AdminLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink/60" />
        <span>Loading… · جارٍ التحميل</span>
      </div>
    </div>
  );
}
