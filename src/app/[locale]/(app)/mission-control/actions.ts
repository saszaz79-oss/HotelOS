'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { correctHotelMetric, type CorrectHotelMetricResult } from '@/server/modules/metrics/commands';
import type { Locale } from '@/i18n/config';
// Side-effect import: registers the insights recomputation subscriber on
// `MetricsExtracted` (Architecture §17) — see insights/index.ts. A metric
// correction re-publishes that same event so Health Score/Alerts/
// Recommendations pick up the corrected value.
import '@/server/modules/insights';

export type CorrectMetricActionResult = CorrectHotelMetricResult | { ok: false; reason: 'FORBIDDEN' | 'INVALID_INPUT' };

/**
 * Post-finalize KPI correction (Analytics fix, Phase 4). Gated to
 * HOTEL_ADMIN/GENERAL_MANAGER — same two-role gate already used for
 * deleting a report (reports/archive/page.tsx's canDelete) — everyone
 * else can see a consistency flag but not an edit control. Checked here,
 * server-side, not just by hiding the control client-side.
 */
export async function correctMetricAction(
  locale: Locale,
  hotelId: string,
  metricDateIso: string,
  metricKey: string,
  formData: FormData
): Promise<CorrectMetricActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await getActiveMembership(user.id);
  if (!membership || membership.hotelId !== hotelId) {
    redirect(`/${locale}/mission-control`);
  }
  if (membership.role !== 'HOTEL_ADMIN' && membership.role !== 'GENERAL_MANAGER') {
    return { ok: false, reason: 'FORBIDDEN' };
  }

  const rawValue = String(formData.get('newValue') ?? '');
  const newValue = Number(rawValue);
  const reason = String(formData.get('reason') ?? '').trim();
  if (rawValue === '' || Number.isNaN(newValue) || reason === '') {
    return { ok: false, reason: 'INVALID_INPUT' };
  }

  const metricDate = new Date(metricDateIso);
  const result = await correctHotelMetric(hotelId, metricDate, metricKey, newValue, user.id, reason);

  if (result.ok) {
    revalidatePath(`/${locale}/mission-control`);
    revalidatePath(`/${locale}/reports/export`);
    revalidatePath(`/${locale}/timeline`);
  }

  return result;
}
