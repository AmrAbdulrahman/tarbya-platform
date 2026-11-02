import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
// The seed is a dev script, not part of the db build, so it may use shared directly.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { DEFAULT_SETTINGS } from '@tarbya/shared';
import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Starter lookups (design/screens/ActivityTypes.dc.html), added only to empty tables.
const activityTypes = [
  { nameAr: 'نزهة', nameEn: 'Outing', scope: 'INDIVIDUAL', color: 'GREEN' },
  {
    nameAr: 'سفر',
    nameEn: 'Travel',
    scope: 'INDIVIDUAL',
    color: 'NAVY',
    reminder: 'H48',
  },
  {
    nameAr: 'رياضة',
    nameEn: 'Sports',
    scope: 'INDIVIDUAL',
    color: 'AMBER',
    reminder: 'H3',
  },
  { nameAr: 'طعام', nameEn: 'Food', scope: 'INDIVIDUAL', color: 'ROSE' },
  {
    nameAr: 'درس / حلقة',
    nameEn: 'Dars / Halaqa',
    scope: 'GROUP_RECURRING',
    color: 'PURPLE',
    requiresRsvp: true,
    tracksAttendance: true,
    reminder: 'H24',
  },
  {
    nameAr: 'لقاء رياضي',
    nameEn: 'Sports meetup',
    scope: 'GROUP_RECURRING',
    color: 'AMBER',
    requiresRsvp: true,
    tracksAttendance: true,
    reminder: 'H3',
  },
  {
    nameAr: 'مخيّم',
    nameEn: 'Camp',
    scope: 'GROUP_ONE_OFF',
    color: 'GREEN',
    requiresRsvp: true,
    tracksAttendance: true,
    reminder: 'H48',
  },
] as const;

const trackingMethods = [
  { nameAr: 'مقياس 1–10', nameEn: 'Scale 1–10' },
  { nameAr: 'عدد تراكمي', nameEn: 'Running count' },
  { nameAr: 'مرات أسبوعيًا', nameEn: 'Times per week' },
  { nameAr: 'نسبة إنجاز', nameEn: 'Completion %' },
];

async function main() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: {},
    });
  }

  if ((await prisma.activityType.count()) === 0) {
    await prisma.activityType.createMany({ data: [...activityTypes] });
  }
  if ((await prisma.trackingMethod.count()) === 0) {
    await prisma.trackingMethod.createMany({ data: trackingMethods });
  }

  // The super admin is identified by SUPER_ADMIN_EMAIL (BR-USR-3); make sure the user exists.
  const email = process.env['SUPER_ADMIN_EMAIL']?.trim().toLowerCase();
  if (email) {
    await prisma.user.upsert({
      where: { email },
      create: { email, name: process.env['SUPER_ADMIN_NAME'] ?? 'Super admin' },
      update: {},
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
