import { test, expect } from '@playwright/test';

test('opens in Arabic, right-to-left, and switches to English', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toHaveText('مرحبًا بك في تربية');

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('h1')).toHaveText('Welcome to Tarbya');
});
