import { test, expect } from '@playwright/test';
import { ensureArabic, usePasswordForm } from './support';

const email = process.env['SUPER_ADMIN_EMAIL'] as string;
const password = process.env['SUPER_ADMIN_PASSWORD'] as string;

test('the super admin views the app as a user from the header, then goes back', async ({
  page,
}) => {
  await page.goto('/login');
  await usePasswordForm(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await ensureArabic(page);

  // A fresh e2e moderator; the teardown removes them and the audit rows.
  const tag = Date.now().toString(36);
  const name = `مشرف ${tag}`;
  const userEmail = `mod.${tag}@tarbya.test`;
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  const created = await page.request.post('/api/users', {
    headers,
    data: { name, email: userEmail },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const { id } = await created.json();
  const appointed = await page.request.put(`/api/users/${id}/moderator`, {
    headers,
    data: { isModerator: true },
  });
  expect(appointed.ok(), await appointed.text()).toBe(true);

  await page.getByRole('button', { name: 'التصفح بصفة مستخدم' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'تصفّح التطبيق بصفة مستخدم',
  });
  const picker = dialog.getByRole('combobox', { name: 'المستخدم' });
  await picker.fill(userEmail);
  await expect(
    dialog.getByRole('option', { name: new RegExp(name) }),
  ).toBeVisible();
  await picker.press('Enter');

  const banner = page.getByRole('region', {
    name: 'وضع التصفح بصفة مستخدم آخر',
  });
  await expect(banner).toContainText(`أنت تتصفح التطبيق بصفة ${name}.`);
  // A moderator's home, and no way to impersonate from inside.
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole('button', { name: 'التصفح بصفة مستخدم' }),
  ).toBeHidden();

  await banner.getByRole('button', { name: 'العودة إلى حسابي' }).click();
  await expect(banner).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'التصفح بصفة مستخدم' }),
  ).toBeVisible();
});
