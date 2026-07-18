import { prisma } from '@/lib/prisma';
import type { HotelStatus, User } from '@prisma/client';
import { hashPassword, generateTemporaryPassword } from '@/server/modules/auth/password';
import { audit } from '@/server/modules/audit';

function requireSuperAdmin(actingUser: User): void {
  if (!actingUser.isSuperAdmin) {
    throw new Error('FORBIDDEN: platform administration requires Super Admin (Platform Owner)');
  }
}

export interface CreateHotelInput {
  name: string;
  logoUrl?: string;
  country: string;
  city: string;
  currency: string;
  timezone: string;
  totalRooms: number;
  pmsType?: string;
  licenseStartDate?: Date;
  licenseExpiryDate?: Date;
  subscriptionPlan: string;
  adminUsername: string;
  adminDisplayName: string;
}

export interface CreateHotelResult {
  hotelId: string;
  adminUserId: string;
  adminUsername: string;
  temporaryPassword: string;
}

/**
 * Creates a hotel and its initial Hotel Admin account together (Product
 * Owner directive: "Creating a hotel should automatically support creating
 * its initial Hotel Admin account in the same workflow"). Platform Owner
 * (Super Admin) only — enforced here, not just at the UI layer (Architecture
 * §4/§5 defense-in-depth pattern applied to platform administration).
 */
export async function createHotelWithAdmin(
  actingUser: User,
  input: CreateHotelInput
): Promise<CreateHotelResult> {
  requireSuperAdmin(actingUser);

  const existing = await prisma.user.findUnique({ where: { username: input.adminUsername } });
  if (existing) {
    throw new Error('USERNAME_TAKEN');
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const { hotelId, adminUserId } = await prisma.$transaction(async (tx) => {
    const hotel = await tx.hotel.create({
      data: {
        name: input.name,
        logoUrl: input.logoUrl || null,
        country: input.country,
        city: input.city,
        currency: input.currency,
        timezone: input.timezone,
        totalRooms: input.totalRooms,
        pmsType: input.pmsType || null,
        licenseStartDate: input.licenseStartDate ?? null,
        licenseExpiryDate: input.licenseExpiryDate ?? null,
      },
    });

    await tx.subscription.create({
      data: { hotelId: hotel.id, plan: input.subscriptionPlan, status: 'active' },
    });

    const admin = await tx.user.create({
      data: {
        username: input.adminUsername,
        passwordHash,
        displayName: input.adminDisplayName,
        mustChangePassword: true,
      },
    });

    await tx.hotelMembership.create({
      data: { userId: admin.id, hotelId: hotel.id, role: 'HOTEL_ADMIN' },
    });

    return { hotelId: hotel.id, adminUserId: admin.id };
  });

  await audit({
    hotelId,
    userId: actingUser.id,
    action: 'admin.hotel_create',
    metadata: { hotelName: input.name, adminUsername: input.adminUsername, adminUserId },
  });

  return { hotelId, adminUserId, adminUsername: input.adminUsername, temporaryPassword };
}

export interface UpdateHotelInput {
  name?: string;
  logoUrl?: string | null;
  country?: string;
  city?: string;
  currency?: string;
  timezone?: string;
  totalRooms?: number;
  pmsType?: string | null;
  licenseStartDate?: Date | null;
  licenseExpiryDate?: Date | null;
}

export async function updateHotel(actingUser: User, hotelId: string, input: UpdateHotelInput): Promise<void> {
  requireSuperAdmin(actingUser);
  await prisma.hotel.update({ where: { id: hotelId }, data: input });
  await audit({ hotelId, userId: actingUser.id, action: 'admin.hotel_update', metadata: { fields: Object.keys(input) } });
}

/** Hotel Activation / Suspension (Super Admin Console requirement) — archive is separate from suspend and is one-way in v0.1 (no un-archive UI yet). */
export async function setHotelStatus(actingUser: User, hotelId: string, status: HotelStatus): Promise<void> {
  requireSuperAdmin(actingUser);
  await prisma.hotel.update({ where: { id: hotelId }, data: { status } });
  await audit({ hotelId, userId: actingUser.id, action: 'admin.hotel_status_change', metadata: { status } });
}

export async function updateSubscriptionPlan(actingUser: User, hotelId: string, plan: string): Promise<void> {
  requireSuperAdmin(actingUser);
  await prisma.subscription.upsert({
    where: { hotelId },
    update: { plan },
    create: { hotelId, plan, status: 'active' },
  });
  await audit({ hotelId, userId: actingUser.id, action: 'admin.subscription_plan_change', metadata: { plan } });
}
