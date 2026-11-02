import {
  ageSession,
  closeDb,
  createUser,
  latestCode,
  signedIn,
} from '../support/fixtures';

afterAll(closeDb);

// A 4×4 red PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4w8AARwgWXg4AWIMMwVLWc8oAAAAASUVORK5CYII=',
  'base64',
);

function form(bytes: Buffer, type: string, name = 'pic') {
  const data = new FormData();
  data.append('file', new Blob([bytes], { type }), name);
  return data;
}

describe('my profile (E2)', () => {
  it('edits name, language and calendar; new users default to both calendars (US-2.1)', async () => {
    const user = await createUser({ moderator: true });
    const s = await signedIn(user.id);
    expect((await s.get('/api/me/profile')).data).toMatchObject({
      calendar: 'BOTH',
      hasPassword: true,
    });

    const res = await s.patch('/api/me/profile', {
      name: '  New name ',
      locale: 'en',
      calendar: 'HIJRI',
    });
    expect(res.data).toMatchObject({
      name: 'New name',
      locale: 'en',
      calendar: 'HIJRI',
    });
    expect((await s.get('/api/auth/me')).data.locale).toBe('en');
  });

  it('uploads, serves, replaces and removes a profile picture (US-2.1)', async () => {
    const user = await createUser({ moderator: true });
    const s = await signedIn(user.id);

    const up = await s.post('/api/me/avatar', form(PNG, 'image/png'));
    expect(up.status).toBe(200);
    expect(up.data.avatarUrl).toMatch(
      new RegExp(`^/api/files/avatars/${user.id}\\?v=`),
    );

    const img = await s.getBytes(up.data.avatarUrl);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/webp');
    // Resized to a 256px WebP on the server.
    expect(Buffer.from(img.data).subarray(8, 12).toString()).toBe('WEBP');

    const again = await s.post('/api/me/avatar', form(PNG, 'image/png'));
    expect(again.data.avatarUrl).not.toBe(up.data.avatarUrl);

    const fake = await s.post(
      '/api/me/avatar',
      form(Buffer.from('not an image'), 'image/png'),
    );
    expect(fake.data.code).toBe('FILE_TYPE');

    const removed = await s.delete('/api/me/avatar');
    expect(removed.data.avatarUrl).toBeNull();
    expect((await s.getBytes(`/api/files/avatars/${user.id}`)).status).toBe(
      404,
    );
  });

  it('changes email and phone with a code (US-2.2)', async () => {
    const user = await createUser({ moderator: true });
    const other = await createUser();
    const s = await signedIn(user.id);
    const newEmail = `moved-${user.email}`;

    const taken = await s.post('/api/me/contact', {
      kind: 'EMAIL',
      value: other.email,
    });
    expect(taken.data.code).toBe('USER_EMAIL_TAKEN');

    expect(
      (await s.post('/api/me/contact', { kind: 'EMAIL', value: newEmail }))
        .status,
    ).toBe(204);
    const code = await latestCode(newEmail);
    const wrong = await s.post('/api/me/contact/confirm', {
      kind: 'EMAIL',
      code: code === '000000' ? '111111' : '000000',
    });
    expect(wrong.data.code).toBe('AUTH_CODE_INVALID');
    const ok = await s.post('/api/me/contact/confirm', { kind: 'EMAIL', code });
    expect(ok.data.email).toBe(newEmail);

    // A phone is confirmed through the (now new) email: no SMS in v1.
    expect(
      (
        await s.post('/api/me/contact', {
          kind: 'PHONE',
          value: '+20 100 555 1234',
        })
      ).status,
    ).toBe(204);
    const phoneCode = await latestCode(newEmail, code);
    const phone = await s.post('/api/me/contact/confirm', {
      kind: 'PHONE',
      code: phoneCode,
    });
    expect(phone.data.phone).toBe('+201005551234');
  });

  it('changes the password, signing out other sessions (US-2.3)', async () => {
    const user = await createUser({ moderator: true });
    const here = await signedIn(user.id);
    const elsewhere = await signedIn(user.id);

    const wrong = await here.put('/api/me/password', {
      currentPassword: 'nope',
      newPassword: 'a much longer one',
    });
    expect(wrong.data.code).toBe('AUTH_INVALID_CREDENTIALS');
    const short = await here.put('/api/me/password', {
      currentPassword: user.password,
      newPassword: 'short',
    });
    expect(short.data.code).toBe('VALIDATION_FAILED');

    const ok = await here.put('/api/me/password', {
      currentPassword: user.password,
      newPassword: 'a much longer one',
    });
    expect(ok.status).toBe(204);
    expect((await here.get('/api/auth/me')).status).toBe(200);
    expect((await elsewhere.get('/api/auth/me')).status).toBe(401);
  });

  it('sets a first password only right after signing in (US-2.3)', async () => {
    const user = await createUser({ moderator: true, password: null });
    const s = await signedIn(user.id);
    await ageSession(user.id, 60);
    const stale = await s.put('/api/me/password', {
      newPassword: 'first password here',
    });
    expect(stale.data.code).toBe('PASSWORD_REAUTH_REQUIRED');

    const fresh = await signedIn(user.id);
    expect(
      (
        await fresh.put('/api/me/password', {
          newPassword: 'first password here',
        })
      ).status,
    ).toBe(204);
  });
});
