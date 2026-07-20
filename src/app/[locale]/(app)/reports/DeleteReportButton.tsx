'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { DeleteReportResult } from '@/server/modules/reports/commands';
import { Button } from '@/components/ui/Button';

interface Dict {
  delete: string;
  deleteSuccess: string;
  deleteErrors: Record<string, string>;
}

type DeleteFormState = DeleteReportResult & { hasResult?: boolean };

const initialState: DeleteFormState = { ok: true, hasResult: false };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

export function DeleteReportButton({
  action,
  dict,
}: {
  /** Server action already bound to (locale, hotelId, reportUploadId) — only (prevState) remains. */
  action: (prevState: DeleteReportResult) => Promise<DeleteReportResult>;
  dict: Dict;
}) {
  const wrapped = async (prevState: DeleteFormState): Promise<DeleteFormState> => {
    const result = await action(prevState);
    return { ...result, hasResult: true };
  };
  const [state, formAction] = useFormState(wrapped, initialState);

  if (state.hasResult && state.ok) {
    return <span className="text-xs text-status-positive">{dict.deleteSuccess}</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <SubmitButton label={dict.delete} />
      {state.hasResult && !state.ok ? (
        <span className="text-xs text-status-critical">{dict.deleteErrors[state.error] ?? state.error}</span>
      ) : null}
    </form>
  );
}
