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

test('a new mentor sees the assignment in the bell and the notification centre, and reads it (US-7.1, BR-NTF-3)', async ({
  page,
}) => {
  await signIn(page);
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const newUser = async (name: string, mail: string) =>
    (
      await page.request.post('/api/users', {
        headers,
        data: { name, email: `${mail}.${tag}@tarbya.test` },
      })
    ).json();
  const mentor = await newUser(`مربٍّ ${tag}`, 'mentor');
  const menteeName = `نواف ${tag}`;
  const mentee = await newUser(menteeName, 'nawaf');
  await page.request.post('/api/mentorships', {
    headers,
    data: { mentorId: mentor.id, menteeId: mentee.id },
  });
  // View the app as the new mentor, who can sign in and so is notified.
  const viewing = await page.request.post('/api/auth/impersonation', {
    headers,
    data: { userId: mentor.id },
  });
  expect(viewing.ok(), await viewing.text()).toBe(true);

  await page.goto('/notifications');
  await expect(
    page.getByRole('button', { name: 'الإشعارات · إشعار واحد غير مقروء' }),
  ).toBeVisible();
  const title = `أُسند إليك ${menteeName} متابَعًا`;
  await expect(page.getByRole('button', { name: title })).toBeVisible();

  await page.getByRole('tab', { name: 'المجموعات' }).click();
  await expect(page.getByText('لا إشعارات هنا.')).toBeVisible();
  await page.getByRole('tab', { name: 'الكل' }).click();
  await page.getByRole('button', { name: 'تعليم كمقروء' }).click();
  await expect(
    page.getByRole('button', { name: 'الإشعارات', exact: true }),
  ).toBeVisible();

  // The notification leads to the mentee.
  await page.getByRole('button', { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${mentee.id}`));

  // Required types are locked on in-app (US-2.4).
  await page.goto('/profile#notif');
  await expect(
    page.getByRole('checkbox', { name: 'بدء علاقة تربية · داخل التطبيق' }),
  ).toBeDisabled();
  const contactEmail = page.getByRole('checkbox', {
    name: 'حان وقت التواصل · البريد',
  });
  await expect(contactEmail).not.toBeChecked();
  await contactEmail.check();
  await page.reload();
  await expect(contactEmail).toBeChecked();

  await page.request.delete('/api/auth/impersonation', { headers });
});
