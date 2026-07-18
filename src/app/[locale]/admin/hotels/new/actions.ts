'use server';

import { getCurrentUser } from '@/server/modules/auth/session';
import { createHotelWithAdmin } from '@/server/modules/hotels/commands';

export interface CreateHotelActionState {
  error?: string;
  result?: { hotelId: string; adminUsername: string; temporaryPassword: string };
}

export async function createHotelAction(
  _prevState: CreateHotelActionState,
  formData: FormData
): Promise<CreateHotelActionState> {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    return { error: 'FORBIDDEN' };
  }

  const licenseStart = String(formData.get('licenseStartDate') ?? '');
  const licenseExpiry = String(formData.get('licenseExpiryDate') ?? '');

  try {
    const result = await createHotelWithAdmin(user, {
      name: String(formData.get('name') ?? ''),
      logoUrl: String(formData.get('logoUrl') ?? '') || undefined,
      country: String(formData.get('country') ?? ''),
      city: String(formData.get('city') ?? ''),
      currency: String(formData.get('currency') ?? 'SAR'),
      timezone: String(formData.get('timezone') ?? ''),
      totalRooms: Number(formData.get('totalRooms') ?? 0),
      pmsType: String(formData.get('pmsType') ?? '') || undefined,
      licenseStartDate: licenseStart ? new Date(licenseStart) : undefined,
      licenseExpiryDate: licenseExpiry ? new Date(licenseExpiry) : undefined,
      subscriptionPlan: String(formData.get('subscriptionPlan') ?? 'pilot'),
      adminUsername: String(formData.get('adminUsername') ?? ''),
      adminDisplayName: String(formData.get('adminDisplayName') ?? ''),
    });

    return { result };
  } catch (err) {
    if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
      return { error: 'USERNAME_TAKEN' };
    }
    throw err;
  }
}
