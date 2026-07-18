'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/server/modules/auth/session';
import { updateHotel, setHotelStatus, updateSubscriptionPlan } from '@/server/modules/hotels/commands';
import type { HotelStatus } from '@prisma/client';
import type { Locale } from '@/i18n/config';

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) throw new Error('FORBIDDEN');
  return user;
}

export async function updateHotelAction(locale: Locale, hotelId: string, formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();

  const licenseStart = String(formData.get('licenseStartDate') ?? '');
  const licenseExpiry = String(formData.get('licenseExpiryDate') ?? '');

  await updateHotel(user, hotelId, {
    name: String(formData.get('name') ?? ''),
    logoUrl: String(formData.get('logoUrl') ?? '') || null,
    country: String(formData.get('country') ?? ''),
    city: String(formData.get('city') ?? ''),
    currency: String(formData.get('currency') ?? ''),
    timezone: String(formData.get('timezone') ?? ''),
    totalRooms: Number(formData.get('totalRooms') ?? 0),
    pmsType: String(formData.get('pmsType') ?? '') || null,
    licenseStartDate: licenseStart ? new Date(licenseStart) : null,
    licenseExpiryDate: licenseExpiry ? new Date(licenseExpiry) : null,
  });

  const plan = String(formData.get('subscriptionPlan') ?? '');
  if (plan) {
    await updateSubscriptionPlan(user, hotelId, plan);
  }

  revalidatePath(`/${locale}/admin/hotels/${hotelId}`);
}

export async function setHotelStatusAction(locale: Locale, hotelId: string, status: HotelStatus): Promise<void> {
  const user = await requireSuperAdmin();
  await setHotelStatus(user, hotelId, status);
  revalidatePath(`/${locale}/admin/hotels/${hotelId}`);
  revalidatePath(`/${locale}/admin/hotels`);
}
