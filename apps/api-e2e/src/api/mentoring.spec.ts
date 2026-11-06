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

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();
const inDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString();

let admin: Session;
let oneToOneTypeId: string;
let groupTypeId: string;

beforeAll(async () => {
  admin = await signedIn((await createUser({ moderator: true })).id);
  const individual = await admin.post('/api/lookups/activity-types', {
    nameAr: 'نزهة اختبار',
    nameEn: 'e2e Outing',
    scope: 'INDIVIDUAL',
  });
  const group = await admin.post('/api/lookups/activity-types', {
    nameAr: 'حلقة اختبار',
    nameEn: 'e2e Halaqa',
    scope: 'GROUP_RECURRING',
  });
  oneToOneTypeId = individual.data.id;
  groupTypeId = group.data.id;
});

/** A mentor with one mentee, both with sessions; the mentorship can start in the past. */
async function pair(startedDaysAgo = 0) {
  const mentor = await createUser();
  const mentee = await createUser();
  await createMentorship(
    mentor.id,
    mentee.id,
    new Date(Date.now() - startedDaysAgo * 86_400_000),
  );
  return {
    mentor,
    mentee,
    asMentor: await signedIn(mentor.id),
    asMentee: await signedIn(mentee.id),
  };
}

describe('mentorships (US-3.3)', () => {
  it('assigns, refuses a second mentor unless replacing, and ends', async () => {
    const [first, second, mentee] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
    ]);

    const assigned = await admin.post('/api/mentorships', {
      mentorId: first.id,
      menteeId: mentee.id,
    });
    expect(assigned.status).toBe(200);
    expect(assigned.data.mentor.id).toBe(first.id);

    const taken = await admin.post('/api/mentorships', {
      mentorId: second.id,
      menteeId: mentee.id,
    });
    expect(taken.status).toBe(409);
    expect(taken.data).toMatchObject({
      code: 'MENTEE_HAS_MENTOR',
      detail: expect.any(String),
    });

    const replaced = await admin.post('/api/mentorships', {
      mentorId: second.id,
      menteeId: mentee.id,
      replace: true,
    });
    expect(replaced.data.mentor.id).toBe(second.id);
    const active = (await admin.get('/api/mentorships')).data as {
      id: string;
      mentee: { id: string };
    }[];
    expect(active.filter((m) => m.mentee.id === mentee.id)).toHaveLength(1);

    const ended = await admin.post(`/api/mentorships/${replaced.data.id}/end`);
    expect(ended.data.endedAt).not.toBeNull();
    expect(await auditActions(assigned.data.id)).toEqual([
      'mentorship.start',
      'mentorship.end',
    ]);
  });

  it('refuses loops in the mentoring chain, self-mentoring and inactive people (BR-MEN-3)', async () => {
    const [top, mid, leaf, gone] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
      createUser({ deactivated: true }),
    ]);
    await admin.post('/api/mentorships', {
      mentorId: top.id,
      menteeId: mid.id,
    });
    await admin.post('/api/mentorships', {
      mentorId: mid.id,
      menteeId: leaf.id,
    });

    for (const [mentorId, menteeId] of [
      [leaf.id, top.id],
      [mid.id, mid.id],
    ]) {
      const res = await admin.post('/api/mentorships', { mentorId, menteeId });
      expect(res.data.code).toBe('MENTORSHIP_CYCLE');
    }
    const inactive = await admin.post('/api/mentorships', {
      mentorId: top.id,
      menteeId: gone.id,
    });
    expect(inactive.data.code).toBe('USER_INACTIVE');
  });

  it('is admin-only', async () => {
    const { asMentor, mentor, mentee } = await pair();
    expect((await asMentor.get('/api/mentorships')).status).toBe(403);
    expect((await asMentor.get('/api/hierarchy/management')).status).toBe(403);
    expect(
      (
        await asMentor.post('/api/mentorships', {
          mentorId: mentor.id,
          menteeId: mentee.id,
        })
      ).status,
    ).toBe(403);
  });
});

describe('follow-ups, tasks and last contact (US-4.3, BR-FU-3…5)', () => {
  it('logs a follow-up with challenges and tasks, and updates last contact', async () => {
    const { mentee, asMentor, asMentee } = await pair();

    const before = (await asMentor.get('/api/mentorships/mine')).data;
    expect(before.mentees[0]).toMatchObject({
      lastContactAt: null,
      contactStatus: 'REGULAR',
      openTasks: 0,
    });

    const res = await asMentor.post('/api/interactions/follow-ups', {
      menteeId: mentee.id,
      startsAt: daysAgo(1),
      place: ' Mosque ',
      sharedNotes: 'Good progress',
      privateNotes: 'Watch for stress',
      challenges: ['Exams', '  '],
      tasks: [
        { title: 'Weekly review plan', dueOn: '2026-11-10' },
        { title: 'Read chapter 2' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      kind: 'FOLLOW_UP',
      status: 'DONE',
      place: 'Mosque',
      challenges: ['Exams'],
      privateNotes: 'Watch for stress',
      participants: [{ id: mentee.id, name: expect.any(String) }],
    });
    expect(
      res.data.tasks.map((t: { dueOn: string | null }) => t.dueOn),
    ).toEqual(['2026-11-10', null]);

    const after = (await asMentor.get('/api/mentorships/mine')).data.mentees[0];
    expect(after.lastContactAt).not.toBeNull();
    expect(after).toMatchObject({
      contactStatus: 'REGULAR',
      daysSinceContact: 1,
      openTasks: 2,
    });

    // The mentee sees it, without the private notes (BR-NOTE-1).
    const timeline = (
      await asMentee.get(`/api/interactions?userId=${mentee.id}`)
    ).data;
    expect(timeline.items[0]).toMatchObject({
      id: res.data.id,
      sharedNotes: 'Good progress',
      privateNotes: null,
    });
    expect(
      (await admin.get(`/api/interactions/${res.data.id}`)).data.privateNotes,
    ).toBe('Watch for stress');

    // The mentee ticks a task (BR-FU-4).
    const task = res.data.tasks[0];
    const done = await asMentee.patch(`/api/tasks/${task.id}`, { done: true });
    expect(done.data.doneAt).not.toBeNull();
    const open = (await asMentee.get(`/api/tasks?assigneeId=${mentee.id}`))
      .data;
    expect(open.map((t: { id: string }) => t.id)).not.toContain(task.id);
  });

  it('treats a future follow-up as upcoming, not as contact', async () => {
    const { mentee, asMentor } = await pair();
    const res = await asMentor.post('/api/interactions/follow-ups', {
      menteeId: mentee.id,
      startsAt: inDays(2),
    });
    expect(res.data.status).toBe('UPCOMING');
    expect(
      (await asMentor.get('/api/mentorships/mine')).data.mentees[0]
        .lastContactAt,
    ).toBeNull();
  });

  it('refuses follow-ups and views for someone who is not your mentee', async () => {
    const { mentee } = await pair();
    const stranger = await signedIn((await createUser()).id);
    const res = await stranger.post('/api/interactions/follow-ups', {
      menteeId: mentee.id,
      startsAt: daysAgo(1),
    });
    expect(res.data.code).toBe('NOT_YOUR_MENTEE');
    expect(
      (await stranger.get(`/api/interactions?userId=${mentee.id}`)).status,
    ).toBe(403);
    expect(
      (await stranger.get(`/api/tasks?assigneeId=${mentee.id}`)).status,
    ).toBe(403);
  });
});

describe('activities (US-4.4)', () => {
  it('logs an activity with anyone active, shown in each participant’s timeline', async () => {
    const { mentee, asMentor } = await pair(10);
    const friend = await createUser();

    const startsAt = daysAgo(2);
    const res = await asMentor.post('/api/interactions/activities', {
      activityTypeId: oneToOneTypeId,
      title: 'Hike',
      startsAt,
      endsAt: daysAgo(1),
      participantIds: [mentee.id, friend.id],
    });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      kind: 'ACTIVITY',
      title: 'Hike',
      activityType: { id: oneToOneTypeId },
    });
    expect(res.data.participants).toHaveLength(2);

    const friendView = await signedIn(friend.id);
    const items = (
      await friendView.get(`/api/interactions?userId=${friend.id}`)
    ).data.items;
    expect(items.map((i: { id: string }) => i.id)).toContain(res.data.id);

    // Counts as contact with the mentee (BR-FU-5).
    const mine = (await asMentor.get('/api/mentorships/mine')).data.mentees[0];
    expect(mine).toMatchObject({
      lastContactAt: startsAt,
      daysSinceContact: 2,
    });
  });

  it('refuses group types, inactive participants, bad dates and non-mentors', async () => {
    const { mentee, asMentor } = await pair();
    const gone = await createUser({ deactivated: true });
    const base = {
      title: 'X',
      startsAt: daysAgo(1),
      participantIds: [mentee.id],
    };

    const wrongType = await asMentor.post('/api/interactions/activities', {
      ...base,
      activityTypeId: groupTypeId,
    });
    expect(wrongType.data.code).toBe('ACTIVITY_TYPE_INVALID');

    const inactive = await asMentor.post('/api/interactions/activities', {
      ...base,
      activityTypeId: oneToOneTypeId,
      participantIds: [gone.id],
    });
    expect(inactive.data.code).toBe('USER_INACTIVE');

    const backwards = await asMentor.post('/api/interactions/activities', {
      ...base,
      activityTypeId: oneToOneTypeId,
      endsAt: daysAgo(3),
    });
    expect(backwards.data.errors).toHaveProperty('endsAt');

    const notMentor = await signedIn((await createUser()).id);
    const refused = await notMentor.post('/api/interactions/activities', {
      ...base,
      activityTypeId: oneToOneTypeId,
    });
    expect(refused.status).toBe(403);
  });
});

describe('notes (US-4.6, US-5.3)', () => {
  it('hides private notes from the mentee and asks before sharing one', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const priv = await asMentor.post('/api/notes', {
      menteeId: mentee.id,
      visibility: 'PRIVATE',
      body: 'Only us',
    });
    await asMentor.post('/api/notes', {
      menteeId: mentee.id,
      visibility: 'SHARED',
      body: 'Well done',
    });

    const theirs = (await asMentee.get(`/api/notes?menteeId=${mentee.id}`))
      .data;
    expect(theirs.map((n: { body: string }) => n.body)).toEqual(['Well done']);
    expect(
      (await asMentor.get(`/api/notes?menteeId=${mentee.id}`)).data,
    ).toHaveLength(2);

    const widen = await asMentor.patch(`/api/notes/${priv.data.id}`, {
      visibility: 'SHARED',
    });
    expect(widen.data.code).toBe('NOTE_WIDEN_CONFIRM');
    const confirmed = await asMentor.patch(`/api/notes/${priv.data.id}`, {
      visibility: 'SHARED',
      confirmWiden: true,
    });
    expect(confirmed.data.visibility).toBe('SHARED');

    expect(
      (await asMentee.patch(`/api/notes/${priv.data.id}`, { body: 'Hacked' }))
        .status,
    ).toBe(403);
    expect(
      (
        await asMentee.post('/api/notes', {
          menteeId: mentee.id,
          visibility: 'SHARED',
          body: 'x',
        })
      ).status,
    ).toBe(403);
  });
});

describe('people search', () => {
  it('lists the mentor’s mentees first and is closed to non-mentors', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const people = (await asMentor.get('/api/people')).data;
    expect(people[0]).toMatchObject({ id: mentee.id, isMyMentee: true });
    expect((await asMentee.get('/api/people')).status).toBe(403);
  });

  it('finds, from the header, only people the viewer may open, whatever alef they typed', async () => {
    const tag = Date.now().toString(36);
    const mentor = await createUser();
    const mentee = await createUser({ name: `E2E إبراهيم ${tag}` });
    const stranger = await createUser({ name: `E2E ابراهيم ${tag} آخر` });
    await createMentorship(mentor.id, mentee.id);
    const q = `?q=${encodeURIComponent(`ابراهيم ${tag}`)}`;
    const asMentor = await signedIn(mentor.id);
    expect((await asMentor.get(`/api/search/people${q}`)).data).toEqual([
      expect.objectContaining({ id: mentee.id, isMyMentee: true }),
    ]);
    const asAdmin = await signedIn(await superAdminId());
    const ids = (
      (
        await asAdmin.get(
          `/api/search/people?q=${encodeURIComponent(`أبراهيم ${tag}`)}`,
        )
      ).data as { id: string }[]
    ).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([mentee.id, stranger.id]));
  });
});
