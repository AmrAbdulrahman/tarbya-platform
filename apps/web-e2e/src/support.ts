import { expect, type Page } from '@playwright/test';

/**
 * Sign-in switches to the account's saved language. The specs read Arabic, so
 * switch the page back if the dev account is set to English; the saved
 * preference stays as it is.
 */
export async function ensureArabic(page: Page) {
  if ((await page.locator('html').getAttribute('lang')) !== 'ar') {
    await page.getByRole('button', { name: 'العربية' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
}

/** The sign-in screen opens on the one-time code; switch to the password form. */
export async function usePasswordForm(page: Page) {
  await page.getByRole('button', { name: 'الدخول بكلمة المرور' }).click();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
}
