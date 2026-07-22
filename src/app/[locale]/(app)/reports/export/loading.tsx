import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

/** Next.js App Router convention: shown instantly while page.tsx's async data fetch resolves, matching its layout so nothing jumps once real content arrives. Every other heavy route already has one of these (Perf fix, Phase 1C) — this page didn't. */
export default function ExecutiveExportLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Card className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </Card>
        ))}
      </div>
      <Card className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </Card>
    </div>
  );
}
