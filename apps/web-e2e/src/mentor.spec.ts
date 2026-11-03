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

/** The super admin mentors a fresh e2e member; the teardown removes both. */
async function newMentee(page: Page) {
  const tag = Date.now().toString(36);
  const name = `يوسف ${tag}`;
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
  return { id: mentee.id as string, name };
}

test('the mentor finds a mentee on the dashboard and shares a note with them (US-4.1, US-4.2, US-4.6)', async ({
  page,
}) => {
  await signIn(page);
  const { name } = await newMentee(page);

  await page.goto('/mentor');
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('لا مؤشرات بعد');
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

test('picks a mentee first, then logs a follow-up from the panel (US-4.3)', async ({
  page,
}) => {
  await signIn(page);
  const { name } = await newMentee(page);

  await page.goto('/mentor/log');
  // Only the mentee picker until someone is chosen.
  await expect(page.getByRole('region', { name: 'السجل' })).toBeHidden();
  await page.getByLabel('المتابَع').selectOption({ label: name });

  const toggle = page.getByRole('button', { name: `تسجيل متابعة مع ${name}` });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const history = page.getByRole('region', { name: 'السجل' });
  await expect(history).toContainText('لا شيء هنا بعد.');

  await toggle.click();
  await page.getByLabel('ملاحظات مشتركة').fill('بداية موفقة');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();

  // Saving closes the panel and confirms with a toast.
  await expect(page.getByRole('status')).toContainText('حُفظت المتابعة.');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(history).toContainText('لقاء متابعة');
});

test('creates a trackable, logs this cycle, and resolves a challenge (US-4.5, US-5.2, BR-CHL-1…3)', async ({
  page,
}) => {
  await signIn(page);
  const { id, name } = await newMentee(page);

  await page.goto(`/people/${id}`);
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'مؤشر جديد' }).click();
  const dialog = page.getByRole('dialog', { name: 'مؤشر جديد' });
  await dialog.getByLabel('الاسم').fill('صلاة الفجر في المسجد');
  await dialog.getByLabel('النوع').selectOption('BOOLEAN');
  await dialog.getByLabel('يُقاس').selectOption('DAILY');
  await dialog.getByRole('button', { name: 'حفظ' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: /صلاة الفجر في المسجد/ }).click();
  const toLog = page.getByRole('region', { name: 'بانتظار التسجيل' });
  await toLog.getByRole('button', { name: 'تم', exact: true }).click();
  await toLog.getByRole('button', { name: 'تسجيل' }).click();
  await expect(page.getByRole('status')).toContainText('سُجّل.');
  await expect(toLog).toBeHidden();
  await expect(
    page.getByRole('region', { name: 'الدورات المسجّلة' }),
  ).toContainText('تم');

  await page.goto(`/people/${id}`);
  const challenges = page.getByRole('region', { name: 'التحديات' });
  await challenges
    .getByRole('textbox', { name: 'تحدٍّ جديد' })
    .fill('ضغط الاختبارات');
  await challenges.getByRole('button', { name: 'إضافة' }).click();
  const item = challenges
    .getByRole('listitem')
    .filter({ hasText: 'ضغط الاختبارات' });
  await item.getByRole('button', { name: 'تم تجاوزه' }).click();
  await expect(item.getByRole('button', { name: 'إعادة فتح' })).toBeVisible();
});
