import {
  auditActions,
  closeDb,
  createMentorship,
  createUser,
  signedIn,
  superAdminId,
} from '../support/fixtures';
import type { Session } from '../support/session';

afterAll(closeDb);

let adminId: string;
let admin: Session;

beforeEach(async () => {
  adminId = await superAdminId();
  // A fresh session each time: impersonation belongs to the session.
  admin = await signedIn(adminId);
});

describe('impersonation (super admin only)', () => {
  it('views the app as another user until stopped, and audits both', async () => {
    const member = await createUser({ moderator: true });
    const start = await admin.post('/api/auth/impersonation', {
      userId: member.id,
    });
    expect(start.status).toBe(200);
    expect(start.data).toMatchObject({
      id: member.id,
      roles: ['MODERATOR'],
      impersonator: { id: adminId },
    });

    const me = await admin.get('/api/auth/me');
    expect(me.data).toMatchObject({
      id: member.id,
      impersonator: { id: adminId },
    });
    // The member's own permissions apply: a moderator, not the super admin.
    const other = await createUser();
    expect(
      (
        await admin.put(`/api/users/${other.id}/moderator`, {
          isModerator: true,
        })
      ).status,
    ).toBe(403);

    const stop = await admin.delete('/api/auth/impersonation');
    expect(stop.status).toBe(200);
    expect(stop.data).toMatchObject({ id: adminId, impersonator: null });
    expect((await admin.get('/api/auth/me')).data.id).toBe(adminId);
    expect(await auditActions(member.id)).toEqual([
      'user.impersonate.start',
      'user.impersonate.stop',
    ]);
  });

  it('records changes made while impersonating as the super admin, on behalf of the user', async () => {
    const moderator = await createUser({ moderator: true });
    const target = await createUser();
    await admin.post('/api/auth/impersonation', { userId: moderator.id });
    const res = await admin.patch(`/api/users/${target.id}`, {
      name: 'Renamed while impersonating',
    });
    expect(res.status).toBe(200);
    const { Client } = await import('pg');
    const c = new Client({ connectionString: process.env['DATABASE_URL'] });
    await c.connect();
    const { rows } = await c.query(
      `SELECT "actorId", "onBehalfOfId" FROM "AuditLog" WHERE "entityId" = $1 AND action = 'user.update'`,
      [target.id],
    );
    await c.end();
    expect(rows).toEqual([{ actorId: adminId, onBehalfOfId: moderator.id }]);
  });

  it('a stopped impersonation token no longer works', async () => {
    const member = await createUser();
    await admin.post('/api/auth/impersonation', { userId: member.id });
    const impersonatedToken = admin.cookies.get('access_token') as string;
    await admin.delete('/api/auth/impersonation');

    const stale = await signedIn(adminId);
    stale.cookies.set('access_token', impersonatedToken);
    expect((await stale.get('/api/auth/me')).status).toBe(401);
  });

  it('blocks sign-in detail changes while impersonating', async () => {
    const member = await createUser();
    await admin.post('/api/auth/impersonation', { userId: member.id });
    const res = await admin.put('/api/me/password', {
      currentPassword: member.password,
      newPassword: 'a much longer password',
    });
    expect(res.status).toBe(403);
    expect(res.data.code).toBe('IMPERSONATION_RESTRICTED');
    expect((await admin.post('/api/auth/sign-out/everywhere')).data.code).toBe(
      'IMPERSONATION_RESTRICTED',
    );
  });

  it('refuses anyone but the super admin, and refuses odd targets', async () => {
    const moderator = await signedIn(
      (await createUser({ moderator: true })).id,
    );
    const member = await createUser();
    expect(
      (await moderator.post('/api/auth/impersonation', { userId: member.id }))
        .status,
    ).toBe(403);

    expect(
      (await admin.post('/api/auth/impersonation', { userId: adminId })).data
        .code,
    ).toBe('SELF_ACTION');
    const gone = await createUser({ deactivated: true });
    expect(
      (await admin.post('/api/auth/impersonation', { userId: gone.id })).data
        .code,
    ).toBe('USER_INACTIVE');
    expect((await admin.delete('/api/auth/impersonation')).status).toBe(403);
  });

  it('marks what the super admin writes while impersonating as on behalf of the user', async () => {
    const mentor = await createUser();
    const mentee = await createUser();
    await createMentorship(mentor.id, mentee.id);
    await admin.post('/api/auth/impersonation', { userId: mentor.id });
    const followUp = await admin.post('/api/interactions/follow-ups', {
      menteeId: mentee.id,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(followUp.data).toMatchObject({
      createdBy: { id: mentor.id },
      impersonator: { id: adminId },
    });
    await admin.post('/api/notes', {
      menteeId: mentee.id,
      visibility: 'PRIVATE',
      body: 'Written by the super admin',
    });
    await admin.delete('/api/auth/impersonation');

    // The mentor's own view of the same records shows who really wrote them.
    const asMentor = await signedIn(mentor.id);
    const feed = await asMentor.get(`/api/feed?userId=${mentee.id}`);
    expect(feed.data.items[0]).toMatchObject({
      kind: 'FOLLOW_UP',
      actor: { id: mentor.id },
      impersonator: { id: adminId },
    });
    const notes = await asMentor.get(`/api/notes?menteeId=${mentee.id}`);
    expect(notes.data[0]).toMatchObject({
      author: { id: mentor.id },
      impersonator: { id: adminId },
    });
    // Written normally, nothing is marked.
    await asMentor.post('/api/notes', {
      menteeId: mentee.id,
      visibility: 'PRIVATE',
      body: 'Written by the mentor',
    });
    const after = await asMentor.get(`/api/notes?menteeId=${mentee.id}`);
    expect(after.data[0].impersonator).toBeNull();
  });

  it("shows admins a member's change log, with impersonation spelled out", async () => {
    const moderator = await createUser({ moderator: true });
    const target = await createUser();
    await admin.post('/api/auth/impersonation', { userId: moderator.id });
    await admin.patch(`/api/users/${target.id}`, { name: 'Renamed' });
    await admin.delete('/api/auth/impersonation');

    const log = await admin.get(`/api/audit?userId=${target.id}`);
    expect(log.status).toBe(200);
    expect(log.data.items).toEqual([
      expect.objectContaining({
        action: 'user.update',
        actor: expect.objectContaining({ id: adminId }),
        onBehalfOf: expect.objectContaining({ id: moderator.id }),
        fields: ['name'],
      }),
    ]);
    const modLog = await admin.get(`/api/audit?userId=${moderator.id}`);
    expect(modLog.data.items.map((i: { action: string }) => i.action)).toEqual([
      'user.impersonate.stop',
      'user.impersonate.start',
    ]);

    const plain = await signedIn(target.id);
    expect((await plain.get(`/api/audit?userId=${target.id}`)).status).toBe(
      403,
    );
  });
});
