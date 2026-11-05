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

test('a mentor messages their mentee from the messages screen (US-7.3, BR-MSG-1)', async ({
  page,
}) => {
  await signIn(page);
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const name = `ريان ${tag}`;
  const newUser = async (n: string, mail: string) =>
    (
      await page.request.post('/api/users', {
        headers,
        data: { name: n, email: `${mail}.${tag}@tarbya.test` },
      })
    ).json();
  // A mentor of their own, viewed through impersonation, so the super admin's
  // mentee list (which other specs read) stays as it is.
  const mentor = await newUser(`مربٍّ ${tag}`, 'mentor');
  const mentee = await newUser(name, 'rayan');
  await page.request.post('/api/mentorships', {
    headers,
    data: { mentorId: mentor.id, menteeId: mentee.id },
  });
  const viewing = await page.request.post('/api/auth/impersonation', {
    headers,
    data: { userId: mentor.id },
  });
  expect(viewing.ok(), await viewing.text()).toBe(true);

  await page.goto('/messages');
  await page.getByRole('searchbox', { name: 'بحث في المحادثات' }).fill(tag);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  const thread = page.getByRole('region', { name });
  await expect(thread.getByText('لا رسائل بعد. ابدأ المحادثة.')).toBeVisible();
  await thread.getByLabel('اكتب رسالة').fill('كيف كانت المراجعة هذا الأسبوع؟');
  await thread.getByLabel('اكتب رسالة').press('Enter');
  await expect(
    thread.getByText('كيف كانت المراجعة هذا الأسبوع؟'),
  ).toBeVisible();
  await expect(thread.getByLabel('اكتب رسالة')).toHaveValue('');
  await expect(
    page.getByRole('button', { name: new RegExp(name) }),
  ).toContainText('أنت: كيف كانت المراجعة');
  await page.request.delete('/api/auth/impersonation', { headers });
});
