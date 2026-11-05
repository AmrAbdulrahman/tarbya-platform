import { test, expect, type Page } from '@playwright/test';
import { ensureArabic, usePasswordForm } from './support';

const email = process.env['SUPER_ADMIN_EMAIL'] as string;
const password = process.env['SUPER_ADMIN_PASSWORD'] as string;
const headers = { 'X-Requested-With': 'XMLHttpRequest' };

async function signIn(page: Page) {
  await page.goto('/login');
  await usePasswordForm(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await ensureArabic(page);
}

/**
 * A mentee with their own mentor (not the super admin, whose mentee list other
 * specs read) and a gathering type; the teardown removes them all.
 */
async function setUp(page: Page) {
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const me = await (await page.request.get('/api/auth/me')).json();
  const name = `بدر ${tag}`;
  const newUser = async (n: string, mail: string) =>
    (
      await page.request.post('/api/users', {
        headers,
        data: { name: n, email: `${mail}.${tag}@tarbya.test` },
      })
    ).json();
  const mentor = await newUser(`مربٍّ ${tag}`, 'mentor');
  const mentee = await newUser(name, 'badr');
  await page.request.post('/api/mentorships', {
    headers,
    data: { mentorId: mentor.id, menteeId: mentee.id },
  });
  const typeName = `e2e درس ${tag}`;
  await page.request.post('/api/lookups/activity-types', {
    headers,
    data: {
      nameAr: typeName,
      nameEn: `e2e lesson ${tag}`,
      scope: 'GROUP_RECURRING',
      requiresRsvp: true,
    },
  });
  return { tag, name, me, typeName };
}

test('a moderator creates a group, adds a member and a weekly gathering, and takes attendance (US-6.1…6.3, US-6.6)', async ({
  page,
}) => {
  await signIn(page);
  const { tag, name, me, typeName } = await setUp(page);
  const groupName = `e2e حلقة ${tag}`;

  await page.goto('/groups');
  await page.getByRole('button', { name: 'مجموعة جديدة' }).click();
  const create = page.getByRole('dialog', { name: 'مجموعة جديدة' });
  await create.getByLabel('اسم المجموعة').fill(groupName);
  await create.getByLabel('مدير المجموعة').fill(me.name);
  await page.getByRole('option', { name: me.name }).first().click();
  await create.getByRole('button', { name: 'إنشاء' }).click();
  await expect(
    page.getByRole('heading', { name: groupName, level: 1 }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'إضافة عضو' }).click();
  const add = page.getByRole('dialog', { name: 'إضافة عضو' });
  await add.getByLabel('الشخص').fill(name);
  await page.getByRole('option', { name }).click();
  await add.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(add).toBeHidden();
  await expect(page.getByText('مجموعة · عضوان')).toBeVisible();

  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  const series = page.getByRole('dialog', { name: 'لقاء دوري جديد' });
  await series.getByLabel('نوع اللقاء').selectOption({ label: typeName });
  await series.getByLabel('المكان (اختياري)').fill('المسجد');
  await series.getByRole('button', { name: 'إنشاء' }).click();
  await expect(series).toBeHidden();

  // The next occurrence opens with everyone still to reply.
  const panel = page.locator('section', {
    has: page.locator('#gathering-title'),
  });
  await expect(panel.getByText('لم يردّوا')).toBeVisible();
  await panel.getByLabel(`حضر: ${name}`).check();
  await panel.getByLabel(`ملاحظة عن ${name}`).fill('حضر مبكرًا');
  await panel.getByRole('button', { name: 'حفظ سجل الحضور' }).click();
  await expect(page.getByText('حُفظ سجل الحضور.')).toBeVisible();
  await expect(panel.getByText('حضروا فعليًا')).toBeVisible();
  await expect(panel.locator('dd', { hasText: '/2' })).toContainText('1');
});
