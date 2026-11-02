import {
  auditActions,
  closeDb,
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
});
