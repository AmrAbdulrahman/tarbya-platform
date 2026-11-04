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
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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

/** Opens "new trackable" on the form, past the library when it has templates (US-4.9). */
async function newTrackableForm(page: Page) {
  await page.getByRole('button', { name: 'مؤشر جديد' }).click();
  const dialog = page.getByRole('dialog');
  const createNew = dialog.getByRole('button', { name: 'إنشاء جديد' });
  const nameField = dialog.getByLabel('الاسم');
  await expect(createNew.or(nameField)).toBeVisible();
  if (await createNew.isVisible()) await createNew.click();
  await expect(page.getByRole('dialog', { name: 'مؤشر جديد' })).toBeVisible();
  return dialog;
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

test("logs a follow-up and an activity from the + button on a mentee's page (US-4.3, US-4.4)", async ({
  page,
}) => {
  await signIn(page);
  const { id, name } = await newMentee(page);
  const other = await newMentee(page);
  const typeName = `e2e نزهة ${Date.now().toString(36)}`;
  const type = await page.request.post('/api/lookups/activity-types', {
    headers,
    data: { nameAr: typeName, nameEn: typeName, scope: 'INDIVIDUAL' },
  });
  expect(type.ok(), await type.text()).toBe(true);

  await page.goto(`/people/${id}`);
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(page.getByText('آخر تواصل:')).toBeVisible();

  // The follow-up opens over the page, with this mentee chosen.
  await page.getByRole('button', { name: 'تسجيل متابعة أو نشاط' }).click();
  await page.getByRole('menuitem', { name: 'متابعة / لقاء' }).click();
  const dialog = page.getByRole('dialog', { name: 'متابعة جديدة' });
  await expect(
    dialog.getByRole('combobox', { name: 'المتابَع', exact: true }),
  ).toHaveValue(id);
  await expect(dialog).toContainText('آخر تواصل');
  await dialog.getByLabel('ملاحظات مشتركة').fill('بداية موفقة');
  await dialog.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('حُفظت المتابعة.');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'السجل' }).click();
  await expect(page.getByRole('region', { name: 'السجل' })).toContainText(
    'لقاء متابعة',
  );

  // An activity takes more people; this mentee is already in.
  await page.getByRole('button', { name: 'تسجيل متابعة أو نشاط' }).click();
  await page.getByRole('menuitem', { name: 'نشاط' }).click();
  const activity = page.getByRole('dialog', { name: 'نشاط جديد' });
  await activity.getByRole('radio', { name: typeName }).click();
  await activity.getByLabel('عنوان النشاط').fill('رحلة إلى البحر');
  await activity.getByRole('button', { name: `إضافة ${other.name}` }).click();
  await activity.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('أُضيف النشاط.');
  await expect(activity).toBeHidden();
});

test('creates a trackable, logs this cycle, and resolves a challenge (US-4.5, US-5.2, BR-CHL-1…3)', async ({
  page,
}) => {
  await signIn(page);
  const { id, name } = await newMentee(page);

  await page.goto(`/people/${id}`);
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  const dialog = await newTrackableForm(page);
  await dialog.getByLabel('الاسم').fill('صلاة الفجر في المسجد');
  await dialog.getByLabel('النوع').selectOption('BOOLEAN');
  await dialog.getByLabel('يُقاس').selectOption('DAILY');
  await dialog.getByRole('button', { name: 'حفظ' }).click();
  await dialog.getByRole('button', { name: 'ليس الآن' }).click();
  await expect(dialog).toBeHidden();

  await page
    .getByRole('region', { name: 'المؤشرات' })
    .getByRole('link', { name: /صلاة الفجر في المسجد/ })
    .click();
  const toLog = page.getByRole('region', { name: 'بانتظار التسجيل' });
  await toLog.getByRole('button', { name: 'تم', exact: true }).click();
  await toLog.getByRole('button', { name: 'تسجيل' }).click();
  await expect(page.getByRole('status')).toContainText('سُجّل.');
  await expect(toLog).toBeHidden();
  await expect(
    page
      .getByRole('region', { name: 'الدورات المسجّلة' })
      .getByRole('img', { name: 'تم' }),
  ).toBeVisible();

  // The mentee's page shows this week's cycles, logged in place (US-4.2).
  await page.getByRole('link', { name }).click();
  const board = page.getByRole('region', { name: 'المؤشرات' });
  const today = board.getByRole('button', { name: /: مسجّل$/ });
  await expect(today.getByRole('img', { name: 'تم' })).toBeVisible();
  await today.click();
  await board.getByRole('button', { name: 'لم يتم' }).click();
  await board.getByRole('button', { name: 'تسجيل' }).click();
  await expect(today.getByRole('img', { name: 'لم يتم' })).toBeVisible();

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

test('saves a trackable as a template and reuses it from the library for another mentee (US-4.9)', async ({
  page,
}) => {
  await signIn(page);
  const first = await newMentee(page);
  const second = await newMentee(page);
  const name = `e2e الفجر ${Date.now().toString(36)}`;

  await page.goto(`/people/${first.id}`);
  const dialog = await newTrackableForm(page);
  await dialog.getByLabel('الاسم').fill(name);
  await dialog.getByLabel('النوع').selectOption('BOOLEAN');
  await dialog.getByLabel('يُقاس').selectOption('DAILY');
  await dialog.getByRole('button', { name: 'حفظ' }).click();

  await expect(
    page.getByRole('dialog', { name: 'أُضيف المؤشر' }),
  ).toBeVisible();
  await dialog.getByLabel('مشاركته مع كل المرشدين').check();
  await dialog.getByRole('button', { name: 'حفظ كقالب' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('حُفظ في المكتبة.')).toBeVisible();

  await page.goto(`/people/${second.id}`);
  await page.getByRole('button', { name: 'مؤشر جديد' }).click();
  await expect(page.getByRole('dialog', { name: 'إضافة مؤشر' })).toBeVisible();
  await dialog.getByRole('searchbox', { name: 'ابحث في المكتبة' }).fill(name);
  const item = dialog.getByRole('button').filter({ hasText: name });
  await expect(item).toContainText('من إعدادك');
  await expect(item).toContainText('متاح لكل المرشدين');
  await item.click();
  await dialog.getByRole('button', { name: 'إضافة المؤشر' }).click();
  await expect(dialog).toBeHidden();
  const board = page.getByRole('region', { name: 'المؤشرات' });
  await expect(board.getByRole('link', { name })).toBeVisible();

  // Its page says it follows the template, used by both mentees.
  await board.getByRole('link', { name }).click();
  const library = page.getByRole('region', { name: 'المكتبة' });
  await expect(library).toContainText('هذا المؤشر يتبع قالبًا من المكتبة.');
  await expect(library).toContainText('مستخدم مع مسترشدَين');
});

test("logs a trackable's waiting cycles right in the mentee's things to do (US-5.1, US-5.2)", async ({
  page,
}) => {
  await signIn(page);
  const { id } = await newMentee(page);
  const day = (offset: number) => {
    const d = new Date(
      `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}T00:00:00Z`,
    );
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const created = await page.request.post('/api/trackables', {
    headers,
    data: {
      menteeId: id,
      name: 'المشي الصباحي',
      type: 'BOOLEAN',
      cycle: 'DAILY',
      startsOn: day(-1),
    },
  });
  expect(created.ok(), await created.text()).toBe(true);

  // See the journey as the mentee.
  const as = await page.request.post('/api/auth/impersonation', {
    headers,
    data: { userId: id },
  });
  expect(as.ok(), await as.text()).toBe(true);
  try {
    await page.goto('/my');
    const item = page
      .getByRole('region', { name: 'إجراءات مطلوبة' })
      .getByRole('listitem')
      .filter({ hasText: 'المشي الصباحي' });
    await expect(item).toContainText('دورتان بانتظار التسجيل');
    await item.getByRole('button', { pressed: false }).first().click();
    await item.getByRole('button', { name: 'تم', exact: true }).click();
    await item.getByRole('button', { name: 'تسجيل' }).click();
    await expect(item).toContainText('دورة واحدة بانتظار التسجيل');
  } finally {
    await page.request.delete('/api/auth/impersonation', { headers });
  }
});
