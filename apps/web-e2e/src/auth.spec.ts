import { test, expect } from '@playwright/test';

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

  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('h1')).toHaveText('مرحبًا بك في تربية');
  // The super admin sees the administration section only.
  await expect(page.getByText('الإدارة')).toBeVisible();
  await expect(page.getByText('متابَعيّ')).toBeHidden();

  await page.getByRole('button', { name: 'حسابي' }).click();
  await page
    .getByRole('menuitem', { name: 'تسجيل الخروج', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('switches between password and one-time code with a link under the form', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();

  await page.getByRole('button', { name: 'الدخول برمز لمرة واحدة' }).click();
  await expect(page.getByLabel('كلمة المرور')).toBeHidden();
  await expect(page.getByRole('button', { name: 'أرسل الرمز' })).toBeVisible();

  await page.getByRole('button', { name: 'الدخول بكلمة المرور' }).click();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
});
