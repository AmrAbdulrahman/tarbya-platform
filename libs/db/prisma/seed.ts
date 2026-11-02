import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Defaults for BR-ORG-5 and BR-AUTH-2; moderators edit them later.
const defaultSettings: Record<string, unknown> = {
  'auth.signInRoles': ['MODERATOR', 'MENTOR'],
  'contact.dueDays': 7,
  'contact.lateDays': 14,
  'gatherings.rsvpRequestHours': 48,
  'gatherings.reminderHours': 3,
  'plans.trendWindow': 3,
  'plans.trendSteadyBand': 0.05,
};

async function main() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: {},
    });
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
