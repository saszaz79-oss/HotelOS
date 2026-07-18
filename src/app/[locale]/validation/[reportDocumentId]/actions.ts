'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/modules/auth/session';
import { recordGroundTruth } from '@/server/modules/validation/commands';
import type { Locale } from '@/i18n/config';

/** Internal validation tool action (Validation Phase §9) — Super Admin only, re-checked here independent of the layout gate (defense in depth, Architecture §5). */
export async function recordGroundTruthAction(
  locale: Locale,
  reportDocumentId: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) redirect(`/${locale}/mission-control`);

  const expectedFields: Record<string, number | null> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('expected__')) {
      const metricKey = key.replace('expected__', '');
      const raw = String(value);
      expectedFields[metricKey] = raw === '' ? null : Number(raw);
    }
  }
  const notes = String(formData.get('notes') ?? '');

  await recordGroundTruth(reportDocumentId, expectedFields, user.id, notes || undefined);
  revalidatePath(`/${locale}/validation/${reportDocumentId}`);
}
