import { test, expect, type Page } from '@playwright/test';
import { ensureArabic } from './support';

const email = process.env['SUPER_ADMIN_EMAIL'] as string;
const password = process.env['SUPER_ADMIN_PASSWORD'] as string;
const headers = { 'X-Requested-With': 'XMLHttpRequest' };

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await ensureArabic(page);
}

test('the mentor finds a mentee on the dashboard and shares a note with them (US-4.1, US-4.2, US-4.6)', async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const name = `يوسف ${tag}`;
  await signIn(page);

  // The super admin mentors a fresh e2e member; the teardown removes both.
  const me = await (await page.request.get('/api/auth/me')).json();
  const mentee = await (
    await page.request.post('/api/users', {
      headers,
      data: { name, email: `yusuf.${tag}@tarbya.test` },
    })
  ).json();
  const assigned = await page.request.post('/api/mentorships', {
    headers,
    data: { mentorId: me.id, menteeId: mentee.id },
  });
  expect(assigned.ok(), await assigned.text()).toBe(true);

  await page.goto('/mentor');
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('لم تُسند خطة بعد');
  await row.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

  const notes = page.getByRole('region', { name: 'الملاحظات' });
  await notes
    .getByRole('textbox', { name: 'ملاحظة جديدة' })
    .fill('يحتاج دعمًا');
  await notes.getByRole('button', { name: 'إضافة ملاحظة' }).click();
  const note = notes.getByRole('listitem').filter({ hasText: 'يحتاج دعمًا' });
  await expect(note).toContainText('خاصة — الموجِّه والمشرفون فقط');

  // Widening a private note asks first (US-4.6).
  await note.getByRole('button', { name: 'تعديل' }).click();
  await note.getByRole('combobox', { name: 'الظهور' }).selectOption('SHARED');
  await note.getByRole('button', { name: 'حفظ' }).click();
  const dialog = page.getByRole('dialog', { name: 'مشاركة الملاحظة؟' });
  await dialog.getByRole('button', { name: 'نعم، شاركها' }).click();
  await expect(dialog).toBeHidden();
  await expect(note).toContainText(`مشتركة مع ${name}`);
});
