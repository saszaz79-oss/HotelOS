import { prisma } from '@/lib/prisma';

const SETTING_KEY = 'enabled_modules';

/**
 * Default enablement per module/context key (Architecture §29). Core v0.1
 * contexts default on; agent contexts beyond the Executive Agent default off
 * until their full implementation ships (Roadmap v0.2+), at which point a
 * hotel's Super Admin/Hotel Admin can opt in per hotel.
 */
const DEFAULT_ENABLED: Record<string, boolean> = {
  reports: true,
  metrics: true,
  timeline: true,
  genome: true,
  executive: true,
  revenue: false,
  front_office: false,
};

/**
 * Checked from the same enforcement points as hotel-scoping and role
 * permission (§4, §13) — a disabled module is unavailable the same way an
 * out-of-scope hotel is, not a UI-only hide.
 */
export async function isModuleEnabled(hotelId: string, moduleKey: string): Promise<boolean> {
  const setting = await prisma.hotelSetting.findUnique({
    where: { hotelId_key: { hotelId, key: SETTING_KEY } },
  });

  if (!setting) {
    return DEFAULT_ENABLED[moduleKey] ?? false;
  }

  const overrides = setting.value as Record<string, boolean>;
  return overrides[moduleKey] ?? DEFAULT_ENABLED[moduleKey] ?? false;
}

export async function setModuleEnabled(hotelId: string, moduleKey: string, enabled: boolean): Promise<void> {
  const existing = await prisma.hotelSetting.findUnique({
    where: { hotelId_key: { hotelId, key: SETTING_KEY } },
  });
  const overrides = (existing?.value as Record<string, boolean>) ?? {};
  overrides[moduleKey] = enabled;

  await prisma.hotelSetting.upsert({
    where: { hotelId_key: { hotelId, key: SETTING_KEY } },
    update: { value: overrides },
    create: { hotelId, key: SETTING_KEY, value: overrides },
  });
}

export const MODULE_KEYS = Object.keys(DEFAULT_ENABLED);

/** Super Admin Console Feature Flags view — current effective state for every known module key. */
export async function getAllModuleStates(hotelId: string): Promise<{ key: string; enabled: boolean }[]> {
  const setting = await prisma.hotelSetting.findUnique({ where: { hotelId_key: { hotelId, key: SETTING_KEY } } });
  const overrides = (setting?.value as Record<string, boolean>) ?? {};
  return MODULE_KEYS.map((key) => ({ key, enabled: overrides[key] ?? DEFAULT_ENABLED[key] ?? false }));
}
