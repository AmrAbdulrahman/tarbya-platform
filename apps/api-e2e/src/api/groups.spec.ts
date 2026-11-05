import {
  closeDb,
  createMentorship,
  createUser,
  notificationTypes,
  setManager,
  signedIn,
  superAdminId,
} from '../support/fixtures';
import type { Session } from '../support/session';

afterAll(closeDb);

let asAdmin: Session;
let gatheringTypeId: string;
let oneOffTypeId: string;

beforeAll(async () => {
  asAdmin = await signedIn(await superAdminId());
  const tag = Date.now().toString(36);
  const recurring = await asAdmin.post('/api/lookups/activity-types', {
    nameAr: `e2e درس ${tag}`,
    nameEn: `e2e lesson ${tag}`,
    scope: 'GROUP_RECURRING',
    requiresRsvp: true,
    tracksAttendance: true,
    reminder: 'H24',
  });
  gatheringTypeId = recurring.data.id;
  const oneOff = await asAdmin.post('/api/lookups/activity-types', {
    nameAr: `e2e مخيم ${tag}`,
    nameEn: `e2e camp ${tag}`,
    scope: 'GROUP_ONE_OFF',
  });
  oneOffTypeId = oneOff.data.id;
});

/** A mentee with an active mentor, so they may join a group (BR-GRP-3). */
async function mentee() {
  const mentor = await createUser();
  const user = await createUser();
  await createMentorship(mentor.id, user.id);
  return user;
}

async function group() {
  const admin = await createUser();
  const created = await asAdmin.post('/api/groups', {
    name: `e2e group ${Date.now().toString(36)}`,
    adminId: admin.id,
  });
  expect(created.status).toBe(200);
  return {
    id: created.data.id as string,
    admin,
    asGroupAdmin: await signedIn(admin.id),
  };
}

describe('groups (US-6.1, US-6.2, BR-GRP-1…4)', () => {
  it('are created by moderators with one admin, who shows the role', async () => {
    const someone = await createUser();
    const asSomeone = await signedIn(someone.id);
    expect(
      (
        await asSomeone.post('/api/groups', {
          name: 'e2e x',
          adminId: someone.id,
        })
      ).status,
    ).toBe(403);

    const { id, admin, asGroupAdmin } = await group();
    const got = await asGroupAdmin.get(`/api/groups/${id}`);
    expect(got.data).toMatchObject({
      admin: { id: admin.id },
      memberCount: 1,
      myRole: 'ADMIN',
      canManage: true,
      canManageRoles: true,
    });
    expect((await asGroupAdmin.get('/api/auth/me')).data.roles).toContain(
      'GROUP_ADMIN',
    );
  });

  it('only take mentees with a mentor as members; moderators come from the admin', async () => {
    const { id, asGroupAdmin } = await group();
    const loner = await createUser();
    const noMentor = await asGroupAdmin.post(`/api/groups/${id}/members`, {
      userId: loner.id,
    });
    expect(noMentor.status).toBe(400);
    expect(noMentor.data.code).toBe('GROUP_MEMBER_NEEDS_MENTOR');

    const member = await mentee();
    expect(
      (
        await asGroupAdmin.post(`/api/groups/${id}/members`, {
          userId: member.id,
        })
      ).data.memberCount,
    ).toBe(2);
    expect(
      (
        await asGroupAdmin.post(`/api/groups/${id}/members`, {
          userId: member.id,
        })
      ).data.code,
    ).toBe('GROUP_ALREADY_MEMBER');

    const moderator = await createUser();
    const withModerator = await asGroupAdmin.post(`/api/groups/${id}/members`, {
      userId: moderator.id,
      role: 'MODERATOR',
    });
    expect(withModerator.data.moderators).toEqual([
      expect.objectContaining({ id: moderator.id }),
    ]);

    // A group moderator manages members but not roles (BR-GRP-2, BR-GRP-10).
    const asModerator = await signedIn(moderator.id);
    const other = await mentee();
    expect(
      (
        await asModerator.post(`/api/groups/${id}/members`, {
          userId: other.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await asModerator.post(`/api/groups/${id}/members`, {
          userId: (await createUser()).id,
          role: 'MODERATOR',
        })
      ).status,
    ).toBe(403);
    expect(
      (await asModerator.delete(`/api/groups/${id}/members/${other.id}`))
        .status,
    ).toBe(200);
  });

  it('hand the admin role over, keeping the old admin as a moderator', async () => {
    const { id, admin, asGroupAdmin } = await group();
    const next = await createUser();
    const res = await asGroupAdmin.post(`/api/groups/${id}/admin`, {
      userId: next.id,
    });
    expect(res.data.admin.id).toBe(next.id);
    expect(res.data.moderators).toEqual([
      expect.objectContaining({ id: admin.id }),
    ]);
    expect(
      (await asGroupAdmin.delete(`/api/groups/${id}/members/${next.id}`)).data
        .code,
    ).toBe('GROUP_ADMIN_LOCKED');
  });

  it('are seen, not joined, by the admin’s manager chain (BR-GRP-4, US-6.7)', async () => {
    const { id, admin } = await group();
    // Not moderators, who see every group anyway (BR-ADM-1).
    const manager = await createUser();
    const top = await createUser();
    await setManager(admin.id, manager.id);
    await setManager(manager.id, top.id);
    const outsider = await signedIn((await createUser()).id);
    expect((await outsider.get(`/api/groups/${id}`)).status).toBe(404);
    expect(
      ((await outsider.get('/api/groups')).data as { id: string }[]).map(
        (g) => g.id,
      ),
    ).not.toContain(id);

    const asTop = await signedIn(top.id);
    expect(
      ((await asTop.get('/api/groups')).data as { id: string }[]).map(
        (g) => g.id,
      ),
    ).toContain(id);
    const seen = await asTop.get(`/api/groups/${id}`);
    expect(seen.data).toMatchObject({
      myRole: null,
      memberCount: 1,
      canManage: false,
    });
    expect(
      (await asTop.post(`/api/groups/${id}/members`, { userId: top.id }))
        .status,
    ).toBe(403);
  });
});

describe('gatherings (US-6.3…6.6, BR-GRP-5…9)', () => {
  it('materialise weekly occurrences, take RSVPs, remind and log attendance', async () => {
    const { id, asGroupAdmin } = await group();
    // A member who is also a mentor can sign in, so receives notifications.
    const member = await mentee();
    await createMentorship(member.id, (await createUser()).id);
    const quiet = await mentee();
    for (const u of [member, quiet])
      await asGroupAdmin.post(`/api/groups/${id}/members`, { userId: u.id });

    const series = await asGroupAdmin.post(`/api/groups/${id}/series`, {
      activityTypeId: gatheringTypeId,
      weekday: 2,
      time: '20:00',
      place: 'Mosque',
    });
    expect(series.status).toBe(200);
    expect(
      (
        await asGroupAdmin.post(`/api/groups/${id}/series`, {
          activityTypeId: oneOffTypeId,
          weekday: 2,
          time: '20:00',
        })
      ).data.code,
    ).toBe('GATHERING_TYPE_INVALID');

    const upcoming = await asGroupAdmin.get(
      `/api/groups/${id}/gatherings?when=upcoming&limit=50`,
    );
    expect(upcoming.data.items.length).toBeGreaterThanOrEqual(7);
    const next = upcoming.data.items[0];
    expect(next).toMatchObject({
      place: 'Mosque',
      counts: { members: 3, attending: 0, noReply: 3, present: null },
    });

    const asMember = await signedIn(member.id);
    const answered = await asMember.put(`/api/gatherings/${next.id}/rsvp`, {
      response: 'ATTENDING',
    });
    expect(answered.data).toMatchObject({
      myRsvp: 'ATTENDING',
      counts: { attending: 1, noReply: 2 },
    });
    const journey = await asMember.get('/api/dashboard/journey');
    expect(journey.data.gatherings[0]).toMatchObject({
      id: next.id,
      myRsvp: 'ATTENDING',
    });

    // Reminders go only to members who haven't replied (US-6.5).
    const asAnother = await signedIn(quiet.id);
    const reminded = await asGroupAdmin.post(
      `/api/gatherings/${next.id}/remind`,
    );
    expect(reminded.status).toBe(200);
    expect(await notificationTypes(member.id)).not.toContain(
      'GATHERING_REMINDER',
    );
    expect(
      (await asAnother.get(`/api/gatherings/${next.id}`)).data.canManage,
    ).toBe(false);

    // One occurrence is cancelled; the others stay (US-6.3).
    const cancelled = await asGroupAdmin.patch(`/api/gatherings/${next.id}`, {
      cancelled: true,
    });
    expect(cancelled.data.cancelledAt).not.toBeNull();
    expect(
      (
        await asMember.put(`/api/gatherings/${next.id}/rsvp`, {
          response: 'NOT_ATTENDING',
        })
      ).data.code,
    ).toBe('GATHERING_CANCELLED');

    // A past one-time activity: attendance, then it shows in the member's feed (BR-GRP-9).
    const past = await asGroupAdmin.post(`/api/groups/${id}/gatherings`, {
      activityTypeId: oneOffTypeId,
      title: 'Camp',
      startsAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(
      (
        await asMember.put(`/api/gatherings/${past.data.id}/attendance`, {
          rows: [{ userId: member.id, present: true }],
        })
      ).status,
    ).toBe(403);
    const logged = await asGroupAdmin.put(
      `/api/gatherings/${past.data.id}/attendance`,
      {
        rows: [
          { userId: member.id, present: true, note: 'Led the quiz' },
          { userId: quiet.id, present: false },
        ],
      },
    );
    expect(logged.data.counts.present).toBe(1);
    expect(
      logged.data.rows.find(
        (r: { member: { id: string } }) => r.member.id === member.id,
      ),
    ).toMatchObject({ present: true, note: 'Led the quiz' });
    const feed = await asMember.get(`/api/feed?userId=${member.id}`);
    expect(feed.data.items).toContainEqual(
      expect.objectContaining({
        kind: 'GATHERING',
        title: 'Camp',
        present: true,
        group: expect.objectContaining({ id }),
      }),
    );
  });

  it('let a group add its own one-time activity types (BR-GRP-6)', async () => {
    const { id, asGroupAdmin } = await group();
    const type = await asGroupAdmin.post(`/api/groups/${id}/activity-types`, {
      nameAr: 'e2e إفطار',
      nameEn: 'e2e breakfast',
    });
    expect(type.data).toMatchObject({ scope: 'GROUP_ONE_OFF', groupId: id });
    const got = await asGroupAdmin.get(`/api/groups/${id}`);
    expect(
      (got.data.activityTypes as { id: string }[]).map((t) => t.id),
    ).toContain(type.data.id);
    const lookups = await asAdmin.get('/api/lookups/activity-types');
    expect((lookups.data as { id: string }[]).map((t) => t.id)).not.toContain(
      type.data.id,
    );
  });
});
