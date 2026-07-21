import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

/** Next.js App Router convention: shown instantly while page.tsx's async data fetch resolves, matching its layout so nothing jumps once real content arrives. */
export default function TimelineLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Card>
        <div className="space-y-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
