import { Skeleton } from '@/components/ui/Skeleton';
import { Card, CardHeader } from '@/components/ui/Card';

/** Next.js App Router convention: shown instantly while page.tsx's async data fetch resolves, matching its layout so nothing jumps once real content arrives. */
export default function ReportsUploadLoading() {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
