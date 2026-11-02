import {
  auditActions,
  closeDb,
  createMentorship,
  createUser,
  signedIn,
  superAdminId,
} from '../support/fixtures';

afterAll(closeDb);

async function moderator() {
  const user = await createUser({ moderator: true });
  return { user, s: await signedIn(user.id) };
}

describe('admin', () => {
  it('is closed to anyone who is not a moderator or the super admin', async () => {
    const mentor = await createUser();
    const mentee = await createUser();
    await createMentorship(mentor.id, mentee.id);
    const s = await signedIn(mentor.id);

    for (const res of [
      await s.get('/api/users'),
      await s.get('/api/settings'),
      await s.post('/api/lookups/tracking-methods', {
        nameAr: 'س',
        nameEn: 'x',
      }),
    ]) {
      expect(res.status).toBe(403);
      expect(res.data.code).toBe('FORBIDDEN');
    }
    // Reading lookups is open to everyone signed in.
    expect((await s.get('/api/lookups/activity-types')).status).toBe(200);
  });

  describe('users (US-3.1)', () => {
    it('creates, finds, edits, deactivates and reactivates a user, with an audit trail', async () => {
      const { s } = await moderator();
      const tag = Date.now().toString(36);

      const created = await s.post('/api/users', {
        name: `  Yusuf ${tag} `,
        email: `Yusuf.${tag}@Tarbya.test`,
        phone: '+20 100-555 0000',
      });
      expect(created.status).toBe(200);
      expect(created.data).toMatchObject({
        name: `Yusuf ${tag}`,
        email: `yusuf.${tag}@tarbya.test`,
        phone: '+201005550000',
        roles: [],
        manager: null,
        canSignIn: false,
      });
      const id = created.data.id;

      const found = await s.get(
        `/api/users?q=${encodeURIComponent(`yusuf ${tag}`)}`,
      );
      expect(found.data.items.map((u: { id: string }) => u.id)).toEqual([id]);

      const dup = await s.post('/api/users', {
        name: 'Twin',
        email: `yusuf.${tag}@tarbya.test`,
      });
      expect(dup.status).toBe(409);
      expect(dup.data.code).toBe('USER_EMAIL_TAKEN');

      const edited = await s.post(`/api/users/${id}`, {}); // wrong verb
      expect(edited.status).toBe(404);
      const patched = await s.patch(`/api/users/${id}`, {
        phone: '',
        locale: 'en',
      });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ phone: null, locale: 'en' });

      const off = await s.post(`/api/users/${id}/deactivate`);
      expect(off.data.deactivatedAt).not.toBeNull();
      const on = await s.post(`/api/users/${id}/reactivate`);
      expect(on.data.deactivatedAt).toBeNull();

      expect(await auditActions(id)).toEqual([
        'user.create',
        'user.update',
        'user.deactivate',
        'user.reactivate',
      ]);
    });

    it('ends the sessions of a deactivated user, and refuses self-deactivation', async () => {
      const { user: me, s } = await moderator();
      const other = await createUser({ moderator: true });
      const theirs = await signedIn(other.id);
      expect((await theirs.get('/api/auth/me')).status).toBe(200);

      await s.post(`/api/users/${other.id}/deactivate`);
      expect((await theirs.get('/api/auth/me')).status).toBe(401);

      const self = await s.post(`/api/users/${me.id}/deactivate`);
      expect(self.status).toBe(409);
      expect(self.data.code).toBe('SELF_ACTION');
    });

    it('paginates by cursor', async () => {
      const { s } = await moderator();
      const first = await s.get('/api/users?limit=2');
      expect(first.data.items).toHaveLength(2);
      const second = await s.get(
        `/api/users?limit=2&cursor=${first.data.nextCursor}`,
      );
      expect(second.data.items[0].id).not.toBe(first.data.items[1].id);
    });
  });

  describe('managers (US-3.4)', () => {
    it('sets managers, derives the manager role, and refuses loops and inactive managers', async () => {
      const { s } = await moderator();
      // Only moderators have managers (BR-MGR-1).
      const top = await createUser({ moderator: true });
      const mid = await createUser({ moderator: true });
      const leaf = await createUser({ moderator: true });
      const gone = await createUser({ moderator: true, deactivated: true });

      expect(
        (await s.put(`/api/users/${mid.id}/manager`, { managerId: top.id }))
          .status,
      ).toBe(200);
      const set = await s.put(`/api/users/${leaf.id}/manager`, {
        managerId: mid.id,
      });
      expect(set.data.manager).toEqual({
        id: mid.id,
        name: expect.any(String),
      });
      expect((await s.get(`/api/users/${mid.id}`)).data.roles).toEqual([
        'MODERATOR',
        'MANAGER',
      ]);

      for (const [user, manager] of [
        [top, leaf],
        [top, top],
      ]) {
        const loop = await s.put(`/api/users/${user.id}/manager`, {
          managerId: manager.id,
        });
        expect(loop.status).toBe(409);
        expect(loop.data.code).toBe('MANAGER_CYCLE');
      }

      const inactive = await s.put(`/api/users/${leaf.id}/manager`, {
        managerId: gone.id,
      });
      expect(inactive.data.code).toBe('MANAGER_INACTIVE');

      const cleared = await s.put(`/api/users/${leaf.id}/manager`, {
        managerId: null,
      });
      expect(cleared.data.manager).toBeNull();
      expect(await auditActions(leaf.id)).toEqual([
        'user.manager.set',
        'user.manager.set',
      ]);
    });
  });

  it('keeps the management line to moderators', async () => {
    const { s } = await moderator();
    const boss = await createUser({ moderator: true });
    const plain = await createUser();

    const notMod = await s.put(`/api/users/${plain.id}/manager`, {
      managerId: boss.id,
    });
    expect(notMod.data.code).toBe('MANAGER_NOT_MODERATOR');

    const mod = await createUser({ moderator: true });
    const byPlain = await s.put(`/api/users/${mod.id}/manager`, {
      managerId: plain.id,
    });
    expect(byPlain.data.code).toBe('MANAGER_NOT_MODERATOR');

    // Demoting: refused while they manage someone; otherwise clears their own manager.
    await s.put(`/api/users/${mod.id}/manager`, { managerId: boss.id });
    const admin = await signedIn(await superAdminId());
    const busy = await admin.put(`/api/users/${boss.id}/moderator`, {
      isModerator: false,
    });
    expect(busy.data.code).toBe('MODERATOR_HAS_REPORTS');
    const demoted = await admin.put(`/api/users/${mod.id}/moderator`, {
      isModerator: false,
    });
    expect(demoted.data).toMatchObject({ isModerator: false, manager: null });
  });

  describe('moderators (US-3.2)', () => {
    it('only the super admin appoints moderators, and the super admin is locked', async () => {
      const { s: mod } = await moderator();
      const target = await createUser();
      const asMod = await mod.put(`/api/users/${target.id}/moderator`, {
        isModerator: true,
      });
      expect(asMod.status).toBe(403);

      const adminId = await superAdminId();
      const admin = await signedIn(adminId);
      const appointed = await admin.put(`/api/users/${target.id}/moderator`, {
        isModerator: true,
      });
      expect(appointed.status).toBe(200);
      expect(appointed.data.roles).toEqual(['MODERATOR']);
      expect(appointed.data.canSignIn).toBe(true);

      const self = await admin.put(`/api/users/${adminId}/moderator`, {
        isModerator: true,
      });
      expect(self.data.code).toBe('SUPER_ADMIN_LOCKED');
      const email = await mod.patch(`/api/users/${adminId}`, {
        email: 'someone@else.test',
      });
      expect(email.data.code).toBe('SUPER_ADMIN_LOCKED');
    });
  });

  describe('settings (US-3.6)', () => {
    it('reads, validates and saves settings, and sign-in follows them', async () => {
      const { s } = await moderator();
      const original = (await s.get('/api/settings')).data;
      expect(original).toMatchObject({
        contactDueDays: expect.any(Number),
        signInRoles: expect.any(Array),
      });

      const bad = await s.patch('/api/settings', {
        contactLateDays: original.contactDueDays,
      });
      expect(bad.status).toBe(400);
      expect(bad.data.errors).toHaveProperty('contactLateDays');

      const mentor = await createUser();
      const mentee = await createUser();
      await createMentorship(mentor.id, mentee.id);
      try {
        const opened = await s.patch('/api/settings', {
          signInRoles: ['MODERATOR', 'MENTOR', 'MENTEE'],
        });
        expect(opened.data.signInRoles).toContain('MENTEE');
        // Same rule sign-in applies; checked here so this suite stays clear of its rate limit.
        expect((await s.get(`/api/users/${mentee.id}`)).data.canSignIn).toBe(
          true,
        );
      } finally {
        await s.patch('/api/settings', { signInRoles: original.signInRoles });
      }
      expect(await auditActions('auth.signInRoles')).toEqual(
        expect.arrayContaining(['settings.update']),
      );
    });
  });

  describe('lookups (US-3.5)', () => {
    it('creates and edits activity types and tracking methods, never deleting them', async () => {
      const { s } = await moderator();
      const created = await s.post('/api/lookups/activity-types', {
        nameAr: 'زيارة',
        nameEn: 'e2e Visit',
        scope: 'GROUP_ONE_OFF',
        requiresRsvp: true,
        reminder: 'H24',
      });
      expect(created.status).toBe(200);
      expect(created.data).toMatchObject({
        color: 'PURPLE',
        active: true,
        showInFeed: true,
      });

      const off = await s.patch(
        `/api/lookups/activity-types/${created.data.id}`,
        { active: false },
      );
      expect(off.data.active).toBe(false);

      const bad = await s.post('/api/lookups/activity-types', {
        nameAr: 'x',
        nameEn: 'x',
        scope: 'NOPE',
      });
      expect(bad.status).toBe(400);

      const method = await s.post('/api/lookups/tracking-methods', {
        nameAr: 'دقائق',
        nameEn: 'e2e Minutes',
      });
      expect(method.data.active).toBe(true);
    });
  });
});
