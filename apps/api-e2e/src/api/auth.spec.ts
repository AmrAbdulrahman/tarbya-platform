import axios from 'axios';
import {
  closeDb,
  createMentorship,
  createUser,
  latestCode,
  messageCount,
} from '../support/fixtures';
import { Session, setCookies } from '../support/session';

afterAll(closeDb);

const signIn = (s: Session, email: string, password: string) =>
  s.post('/api/auth/sign-in/password', { email, password });

describe('auth', () => {
  describe('guards', () => {
    it('answers 401 problem details without a session', async () => {
      const res = await new Session().get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.data).toMatchObject({
        status: 401,
        code: 'AUTH_UNAUTHENTICATED',
      });
    });

    it('refuses mutations without X-Requested-With', async () => {
      const res = await axios.post(
        '/api/auth/sign-in/password',
        { email: 'a@b.c', password: 'x' },
        { validateStatus: () => true },
      );
      expect(res.status).toBe(403);
      expect(res.data.code).toBe('CSRF_HEADER_MISSING');
    });

    it('rejects malformed bodies', async () => {
      const res = await new Session().post('/api/auth/sign-in/password', {
        email: 'nope',
      });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_FAILED');
      expect(Object.keys(res.data.errors)).toEqual(
        expect.arrayContaining(['email', 'password']),
      );
    });
  });

  describe('password sign-in (US-1.1)', () => {
    it('gives one generic error for a wrong password and an unknown email', async () => {
      const user = await createUser({ moderator: true });
      const wrong = await signIn(new Session(), user.email, 'not the password');
      const unknown = await signIn(
        new Session(),
        'nobody@tarbya.test',
        'whatever',
      );
      for (const res of [wrong, unknown]) {
        expect(res.status).toBe(401);
        expect(res.data.code).toBe('AUTH_INVALID_CREDENTIALS');
      }
    });

    it('signs a moderator in with httpOnly cookies and derived roles', async () => {
      const user = await createUser({ moderator: true });
      const s = new Session();
      const res = await signIn(s, user.email.toUpperCase(), user.password);

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        email: user.email,
        roles: ['MODERATOR'],
      });
      const cookies = setCookies(res).join('\n');
      expect(cookies).toMatch(
        /access_token=.+; Max-Age=900; Path=\/api; .*HttpOnly; SameSite=Lax/,
      );
      expect(cookies).toMatch(/refresh_token=.+; Path=\/api\/auth; .*HttpOnly/);

      const me = await s.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.data.id).toBe(user.id);
    });

    it('lets mentors in and keeps mentees out by default (BR-AUTH-2)', async () => {
      const mentor = await createUser();
      const mentee = await createUser();
      await createMentorship(mentor.id, mentee.id);

      const asMentor = await signIn(
        new Session(),
        mentor.email,
        mentor.password,
      );
      expect(asMentor.status).toBe(200);
      expect(asMentor.data.roles).toEqual(['MENTOR']);

      const asMentee = await signIn(
        new Session(),
        mentee.email,
        mentee.password,
      );
      expect(asMentee.status).toBe(403);
      expect(asMentee.data.code).toBe('AUTH_NOT_ALLOWED');
    });

    it('refuses deactivated users', async () => {
      const user = await createUser({ moderator: true, deactivated: true });
      const res = await signIn(new Session(), user.email, user.password);
      expect(res.status).toBe(403);
      expect(res.data.code).toBe('AUTH_DEACTIVATED');
    });
  });

  describe('sessions (US-1.3)', () => {
    it('rotates the refresh token, tolerates the previous one briefly, and signs out', async () => {
      const user = await createUser({ moderator: true });
      const s = new Session();
      await signIn(s, user.email, user.password);
      const firstRefresh = s.cookies.get('refresh_token');

      const rotated = await s.post('/api/auth/refresh');
      expect(rotated.status).toBe(204);
      expect(s.cookies.get('refresh_token')).not.toBe(firstRefresh);

      // A second tab still holding the old token, within the grace window.
      const otherTab = new Session();
      otherTab.cookies.set('refresh_token', firstRefresh as string);
      const grace = await otherTab.post('/api/auth/refresh');
      expect(grace.status).toBe(204);
      expect(setCookies(grace).join()).not.toContain('refresh_token=');
      expect((await otherTab.get('/api/auth/me')).status).toBe(200);

      const out = await s.post('/api/auth/sign-out');
      expect(out.status).toBe(204);
      expect(s.cookies.has('access_token')).toBe(false);

      // The other tab's access token belongs to the same, now revoked, session.
      expect((await otherTab.get('/api/auth/me')).status).toBe(401);
      expect((await otherTab.post('/api/auth/refresh')).status).toBe(401);
    });

    it('signs out every session at once', async () => {
      const user = await createUser({ moderator: true });
      const laptop = new Session();
      const phone = new Session();
      await signIn(laptop, user.email, user.password);
      await signIn(phone, user.email, user.password);

      expect((await laptop.post('/api/auth/sign-out/everywhere')).status).toBe(
        204,
      );
      expect((await phone.get('/api/auth/me')).status).toBe(401);
      expect((await phone.post('/api/auth/refresh')).status).toBe(401);
    });
  });

  describe('one-time code (US-1.2)', () => {
    it('emails a code that signs in once', async () => {
      const user = await createUser({ moderator: true, password: null });
      const s = new Session();

      const req = await s.post('/api/auth/sign-in/code/request', {
        email: user.email,
      });
      expect(req.status).toBe(204);
      const code = await latestCode(user.email);

      const res = await s.post('/api/auth/sign-in/code', {
        email: user.email,
        code,
      });
      expect(res.status).toBe(200);
      expect(res.data.id).toBe(user.id);

      const again = await new Session().post('/api/auth/sign-in/code', {
        email: user.email,
        code,
      });
      expect(again.status).toBe(401);
      expect(again.data.code).toBe('AUTH_CODE_INVALID');
    });

    it('answers the same for unknown and refused addresses, and sends nothing', async () => {
      const mentee = await createUser();
      const unknown = await new Session().post(
        '/api/auth/sign-in/code/request',
        {
          email: 'nobody-here@tarbya.test',
        },
      );
      const refused = await new Session().post(
        '/api/auth/sign-in/code/request',
        {
          email: mentee.email,
        },
      );
      expect(unknown.status).toBe(204);
      expect(refused.status).toBe(204);
      await new Promise((r) => setTimeout(r, 500));
      expect(await messageCount(mentee.email)).toBe(0);
    });

    it('burns the code after five wrong attempts', async () => {
      const user = await createUser({ moderator: true });
      const s = new Session();
      await s.post('/api/auth/sign-in/code/request', { email: user.email });
      const code = await latestCode(user.email);
      const wrong = code === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        const res = await s.post('/api/auth/sign-in/code', {
          email: user.email,
          code: wrong,
        });
        expect(res.data.code).toBe('AUTH_CODE_INVALID');
      }
      const right = await s.post('/api/auth/sign-in/code', {
        email: user.email,
        code,
      });
      expect(right.status).toBe(401);
    });
  });
});
