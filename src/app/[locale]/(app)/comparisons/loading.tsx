import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

/** Next.js App Router convention: shown instantly while page.tsx's async data fetch resolves, matching its layout so nothing jumps once real content arrives. */
export default function ComparisonsLoading() {
  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Card className="space-y-3">
        <Skeleton className="h-4 w-48" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </Card>
      <Card className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[220px] w-full" />
      </Card>
    </div>
  );
}
