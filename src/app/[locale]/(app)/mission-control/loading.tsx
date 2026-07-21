import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

/** Next.js App Router convention: shown instantly while page.tsx's async data fetch resolves, matching its layout so nothing jumps once real content arrives. */
export default function MissionControlLoading() {
  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>
      <Card className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </Card>
    </div>
  );
}
