import { test, expect } from '@playwright/test';
import { ensureArabic, usePasswordForm } from './support';

const email = process.env['SUPER_ADMIN_EMAIL'] as string;
const password = process.env['SUPER_ADMIN_PASSWORD'] as string;

test('sign-in opens in Arabic, right-to-left, and switches to English (US-1.4)', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'تسجيل الدخول',
  );

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Sign in');
});

test('a wrong password shows one generic error (US-1.1)', async ({ page }) => {
  await page.goto('/login');
  await usePasswordForm(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('definitely wrong');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  );
});

test('signs in, returns to the page asked for, and signs out (US-1.1, US-1.3)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?redirect=%2F/);

  await usePasswordForm(page);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();

  // "/" sends the super admin to the console, their strongest role's home (US-1.1).
  await expect(page).toHaveURL(/\/admin\/users$/);
  await ensureArabic(page);
  await expect(page.locator('h1')).toHaveText('المستخدمون');
  // Other sections depend on whom the dev account mentors, so only this one is checked.
  await expect(
    page.getByRole('navigation', { name: 'تربية' }).getByText('الإدارة'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'حسابي' }).click();
  await page
    .getByRole('menuitem', { name: 'تسجيل الخروج', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('opens on the one-time code and switches to the password with a link under the form', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'أرسل الرمز' })).toBeVisible();
  await expect(page.getByLabel('كلمة المرور')).toBeHidden();

  await page.getByRole('button', { name: 'الدخول بكلمة المرور' }).click();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();

  await page.getByRole('button', { name: 'الدخول برمز لمرة واحدة' }).click();
  await expect(page.getByLabel('كلمة المرور')).toBeHidden();
});
