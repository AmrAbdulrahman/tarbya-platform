import { test, expect, type Page } from '@playwright/test';
import { ensureArabic, usePasswordForm } from './support';

const email = process.env['SUPER_ADMIN_EMAIL'] as string;
const password = process.env['SUPER_ADMIN_PASSWORD'] as string;

async function signInAsSuperAdmin(page: Page, path: string) {
  await page.goto(path);
  await usePasswordForm(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await ensureArabic(page);
}

test('adds a moderator with a manager and finds them (US-3.1, US-3.2, US-3.4)', async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  await signInAsSuperAdmin(page, '/admin/users');

  await page.getByRole('button', { name: 'مستخدم', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('الاسم').fill(`سارة ${tag}`);
  await dialog.getByLabel('البريد الإلكتروني').fill(`sara.${tag}@tarbya.test`);
  // Only moderators have a direct manager: the field appears once the box is ticked.
  await expect(
    dialog.getByRole('combobox', { name: 'المدير المباشر' }),
  ).toBeHidden();
  await dialog.getByRole('checkbox', { name: 'مشرف' }).check();
  const manager = dialog.getByRole('combobox', { name: 'المدير المباشر' });
  // By email: the super admin's display name is whatever the dev account set.
  await manager.fill(email);
  const option = dialog.getByRole('option', { name: new RegExp(email) });
  await expect(option).toBeVisible();
  const managerName = (
    (await option.locator('span').first().textContent()) ?? ''
  ).trim();
  await manager.press('Enter');
  await expect(dialog.getByText(managerName, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'حفظ' }).click();
  await expect(dialog).toBeHidden();

  await page
    .getByRole('searchbox', { name: 'بحث في المستخدمين' })
    .fill(`sara.${tag}`);
  const row = page.getByRole('row').filter({ hasText: `سارة ${tag}` });
  await expect(row).toBeVisible();
  await expect(row).toContainText(managerName);
  await expect(row).toContainText('مشرف');
  // A moderator with an email can sign in.
  await expect(row).toContainText('مفعّل');
});

test('the settings form refuses late days that are not after due days (US-3.6)', async ({
  page,
}) => {
  await signInAsSuperAdmin(page, '/admin/settings');
  const late = page.getByLabel('متأخر بعد (أيام)');
  // Equal to the default due days: in range, but not after them.
  await late.fill('7');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(
    page.getByText('يجب أن يكون أكبر من عدد أيام الاستحقاق.'),
  ).toBeVisible();
});
