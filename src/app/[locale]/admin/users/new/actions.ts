'use server';

import { getCurrentUser } from '@/server/modules/auth/session';
import { createUser } from '@/server/modules/users/commands';
import type { HotelRole } from '@prisma/client';

export interface CreateUserActionState {
  error?: string;
  result?: { userId: string; username: string; temporaryPassword: string };
}

export async function createUserAction(
  _prevState: CreateUserActionState,
  formData: FormData
): Promise<CreateUserActionState> {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    return { error: 'FORBIDDEN' };
  }

  try {
    const result = await createUser(user, {
      username: String(formData.get('username') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
      hotelId: String(formData.get('hotelId') ?? ''),
      role: String(formData.get('role') ?? 'READ_ONLY') as HotelRole,
    });
    return { result };
  } catch (err) {
    if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
      return { error: 'USERNAME_TAKEN' };
    }
    throw err;
  }
}
