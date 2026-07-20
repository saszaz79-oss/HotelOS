'use client';

import { Button } from '@/components/ui/Button';

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" className="print-hide" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
