'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { getOrRefreshExecutiveSummary } from '@/server/modules/ai-orchestration/commands';
import type { Locale } from '@/i18n/config';

/**
 * Explicit user-triggered regeneration of the persisted AI Executive
 * Summary (Perf fix, Phase 1B) — same gate and behavior as
 * mission-control/actions.ts's regenerateExecutiveSummaryAction; this page
 * reads through the same cached row (keyed by hotelId/date/language, not
 * by which page requested it), so either page's button keeps both in sync.
 */
export async function regenerateExecutiveSummaryAction(locale: Locale, hotelId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await getActiveMembership(user.id);
  if (!membership || membership.hotelId !== hotelId) {
    redirect(`/${locale}/mission-control`);
  }
  if (membership.role !== 'HOTEL_ADMIN' && membership.role !== 'GENERAL_MANAGER') {
    redirect(`/${locale}/reports/export`);
  }

  await getOrRefreshExecutiveSummary(hotelId, locale, membership.hotel.name, undefined, {
    forceRegenerate: true,
    regeneratedByUserId: user.id,
  });
  revalidatePath(`/${locale}/reports/export`);
  revalidatePath(`/${locale}/mission-control`);
}
