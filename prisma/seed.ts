/**
 * Seed data is clearly labeled demo data (Constitution §2 rule #8).
 *
 * Production safety (Product Owner directive): when NODE_ENV=production,
 * this script never creates the demo hotel/users, and creates the Platform
 * Owner account with a randomly generated password (printed once, never
 * stored anywhere) with mustChangePassword=true — there is no scenario
 * where a production deployment ends up with a known/guessable Platform
 * Owner password.
 *
 * In non-production, seeded accounts use a fixed, clearly-labeled dev
 * password and are NOT flagged mustChangePassword — that flag exists for
 * real temporary passwords issued to real users (Super Admin Console), not
 * for a shared, documented local-development credential. Forcing a change
 * on every fresh `db:seed` run would work against the point of having a
 * predictable dev login.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';
const DEV_PASSWORD = 'ChangeMe123!';

const METRIC_DEFINITIONS = [
  { key: 'occupancy_pct', labelEn: 'Occupancy %', labelAr: 'نسبة الإشغال', unit: 'percentage', isComputed: false },
  { key: 'rooms_available', labelEn: 'Rooms Available', labelAr: 'الغرف المتاحة', unit: 'count', isComputed: false },
  { key: 'rooms_sold', labelEn: 'Rooms Sold', labelAr: 'الغرف المباعة', unit: 'count', isComputed: false },
  { key: 'rooms_occupied', labelEn: 'Rooms Occupied', labelAr: 'الغرف المشغولة', unit: 'count', isComputed: false },
  { key: 'out_of_order_rooms', labelEn: 'Out of Order Rooms', labelAr: 'غرف خارج الخدمة', unit: 'count', isComputed: false },
  { key: 'out_of_inventory_rooms', labelEn: 'Out of Inventory Rooms', labelAr: 'غرف خارج المخزون', unit: 'count', isComputed: false },
  { key: 'arrivals', labelEn: 'Arrivals', labelAr: 'الوافدون', unit: 'count', isComputed: false },
  { key: 'departures', labelEn: 'Departures', labelAr: 'المغادرون', unit: 'count', isComputed: false },
  { key: 'stayovers', labelEn: 'Stayovers', labelAr: 'الإقامات المستمرة', unit: 'count', isComputed: false },
  { key: 'cancellations', labelEn: 'Cancellations', labelAr: 'الإلغاءات', unit: 'count', isComputed: false },
  { key: 'no_shows', labelEn: 'No-Shows', labelAr: 'عدم الحضور', unit: 'count', isComputed: false },
  { key: 'room_revenue', labelEn: 'Room Revenue', labelAr: 'إيرادات الغرف', unit: 'currency', isComputed: false },
  { key: 'total_revenue', labelEn: 'Total Revenue', labelAr: 'إجمالي الإيرادات', unit: 'currency', isComputed: false },
  { key: 'adr', labelEn: 'ADR', labelAr: 'متوسط سعر الغرفة', unit: 'currency', isComputed: true },
  { key: 'revpar', labelEn: 'RevPAR', labelAr: 'الإيراد لكل غرفة متاحة', unit: 'currency', isComputed: true },
  { key: 'open_balance', labelEn: 'Open Balance', labelAr: 'الرصيد المفتوح', unit: 'currency', isComputed: false },
  { key: 'cash', labelEn: 'Cash', labelAr: 'نقدي', unit: 'currency', isComputed: false },
  { key: 'card', labelEn: 'Card', labelAr: 'بطاقة', unit: 'currency', isComputed: false },
  { key: 'city_ledger', labelEn: 'City Ledger', labelAr: 'دفتر المدينة', unit: 'currency', isComputed: false },
  { key: 'complimentary_rooms', labelEn: 'Complimentary Rooms', labelAr: 'الغرف المجانية', unit: 'count', isComputed: false },
  { key: 'house_use_rooms', labelEn: 'House Use Rooms', labelAr: 'غرف الاستخدام الداخلي', unit: 'count', isComputed: false },
  { key: 'adults', labelEn: 'Adults', labelAr: 'البالغون', unit: 'count', isComputed: false },
  { key: 'children', labelEn: 'Children', labelAr: 'الأطفال', unit: 'count', isComputed: false },
  { key: 'total_guests', labelEn: 'Total Guests', labelAr: 'إجمالي النزلاء', unit: 'count', isComputed: false },
];

async function seedMetricDefinitions() {
  for (const def of METRIC_DEFINITIONS) {
    await prisma.metricDefinition.upsert({ where: { key: def.key }, update: def, create: def });
  }
}

async function seedProductionPlatformOwner() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existing) {
    console.log('Platform Owner account "admin" already exists — skipping (no password change performed).');
    return;
  }

  const temporaryPassword = randomBytes(16).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      displayName: 'Platform Owner',
      isSuperAdmin: true,
      preferredLanguage: 'ar',
      mustChangePassword: true,
    },
  });

  console.log('=================================================================');
  console.log('PRODUCTION Platform Owner account created.');
  console.log('Username: admin');
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log('This password is shown ONLY ONCE and is not stored anywhere.');
  console.log('You will be required to change it on first login.');
  console.log('=================================================================');
}

async function seedDevAccounts() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const superAdmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      passwordHash,
      displayName: 'Platform Owner (Dev)',
      isSuperAdmin: true,
      preferredLanguage: 'en',
    },
  });

  const demoHotel = await prisma.hotel.upsert({
    where: { id: 'demo-hotel' },
    update: {},
    create: {
      id: 'demo-hotel',
      name: 'HotelOS Demo Hotel (Riyadh)',
      country: 'Saudi Arabia',
      city: 'Riyadh',
      timezone: 'Asia/Riyadh',
      currency: 'SAR',
      totalRooms: 120,
      roomTypes: [{ code: 'STD', name: 'Standard' }, { code: 'DLX', name: 'Deluxe' }],
      pmsType: 'Opera Cloud',
      status: 'active',
    },
  });

  await prisma.subscription.upsert({
    where: { hotelId: demoHotel.id },
    update: {},
    create: { hotelId: demoHotel.id, plan: 'pilot', status: 'active' },
  });

  const hotelAdmin = await prisma.user.upsert({
    where: { username: 'hoteladmin.demo' },
    update: {},
    create: { username: 'hoteladmin.demo', passwordHash, displayName: 'Demo Hotel Admin', preferredLanguage: 'ar' },
  });
  await prisma.hotelMembership.upsert({
    where: { userId_hotelId: { userId: hotelAdmin.id, hotelId: demoHotel.id } },
    update: {},
    create: { userId: hotelAdmin.id, hotelId: demoHotel.id, role: 'HOTEL_ADMIN' },
  });

  const gm = await prisma.user.upsert({
    where: { username: 'gm.demo' },
    update: {},
    create: { username: 'gm.demo', passwordHash, displayName: 'Demo General Manager', preferredLanguage: 'ar' },
  });
  await prisma.hotelMembership.upsert({
    where: { userId_hotelId: { userId: gm.id, hotelId: demoHotel.id } },
    update: {},
    create: { userId: gm.id, hotelId: demoHotel.id, role: 'GENERAL_MANAGER' },
  });

  const readOnly = await prisma.user.upsert({
    where: { username: 'readonly.demo' },
    update: {},
    create: { username: 'readonly.demo', passwordHash, displayName: 'Demo Read Only', preferredLanguage: 'ar' },
  });
  await prisma.hotelMembership.upsert({
    where: { userId_hotelId: { userId: readOnly.id, hotelId: demoHotel.id } },
    update: {},
    create: { userId: readOnly.id, hotelId: demoHotel.id, role: 'READ_ONLY' },
  });

  console.log('=================================================================');
  console.log('Seed complete — DEVELOPMENT credentials (never use in production):');
  console.log('');
  console.log('Platform Owner (Super Admin)');
  console.log('  Username: superadmin');
  console.log(`  Password: ${DEV_PASSWORD}`);
  console.log('');
  console.log('Hotel Admin');
  console.log('  Username: hoteladmin.demo');
  console.log(`  Password: ${DEV_PASSWORD}`);
  console.log('');
  console.log('General Manager');
  console.log('  Username: gm.demo');
  console.log(`  Password: ${DEV_PASSWORD}`);
  console.log('');
  console.log('Read Only');
  console.log('  Username: readonly.demo');
  console.log(`  Password: ${DEV_PASSWORD}`);
  console.log('=================================================================');
  void superAdmin;
}

async function main() {
  await seedMetricDefinitions();

  if (isProduction) {
    await seedProductionPlatformOwner();
  } else {
    await seedDevAccounts();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
