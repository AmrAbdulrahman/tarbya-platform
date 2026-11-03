import {
  backdatePlan,
  closeDb,
  createMentorship,
  createUser,
  signedIn,
} from '../support/fixtures';
import type { Session } from '../support/session';

afterAll(closeDb);

const minutesFromNow = (n: number) =>
  new Date(Date.now() + n * 60_000).toISOString();

let admin: Session;
let methodId: string;
let outingId: string;

beforeAll(async () => {
  admin = await signedIn((await createUser({ moderator: true })).id);
  methodId = (
    await admin.post('/api/lookups/tracking-methods', {
      nameAr: 'عدد',
      nameEn: 'e2e Pages',
    })
  ).data.id;
  outingId = (
    await admin.post('/api/lookups/activity-types', {
      nameAr: 'نزهة',
      nameEn: 'e2e Feed outing',
      scope: 'INDIVIDUAL',
    })
  ).data.id;
});

/** A mentor and mentee with a plan, a done follow-up, a check-in, a reply and an upcoming activity. */
async function story() {
  const mentor = await createUser();
  const mentee = await createUser();
  await createMentorship(
    mentor.id,
    mentee.id,
    new Date(Date.now() - 30 * 86_400_000),
  );
  const asMentor = await signedIn(mentor.id);
  const asMentee = await signedIn(mentee.id);
  const plan = (
    await asMentor.post('/api/plans', {
      menteeId: mentee.id,
      name: 'Read daily',
      goal: '20 pages',
      trackingMethodId: methodId,
      target: 20,
    })
  ).data;
  const followUp = await asMentor.post('/api/interactions/follow-ups', {
    menteeId: mentee.id,
    startsAt: minutesFromNow(-5),
    privateNotes: 'e2e secret mentor note',
    challenges: ['exams'],
    tasks: [{ title: 'Summarise a chapter' }],
    planUpdates: [{ planId: plan.id, value: 8 }],
  });
  expect(followUp.status).toBe(200);
  const checkIn = await asMentee.post(`/api/plans/${plan.id}/check-ins`, {
    value: 12,
    note: 'Better week',
  });
  const reading = checkIn.data.readings.find(
    (r: { source: string }) => r.source === 'CHECK_IN',
  );
  await asMentor.post(`/api/plans/readings/${reading.id}/replies`, {
    body: 'Keep going',
  });
  const outing = await asMentor.post('/api/interactions/activities', {
    activityTypeId: outingId,
    title: 'Football',
    participantIds: [mentee.id],
    startsAt: minutesFromNow(60 * 24),
  });
  expect(outing.status).toBe(200);
  return { mentor, mentee, asMentor, asMentee, plan, outing: outing.data };
}

describe('feed and dashboards (US-4.1, US-4.2, US-5.1)', () => {
  it('gives the mentor their mentees, stats, upcoming items and plans', async () => {
    const { mentee, asMentor, plan, outing } = await story();
    const res = await asMentor.get('/api/dashboard/mentor');
    expect(res.status).toBe(200);
    expect(res.data.stats).toMatchObject({
      mentees: 1,
      needContact: 0,
      openPlans: 1,
    });
    expect(res.data.stats.monthFollowUps).toBeGreaterThanOrEqual(1);
    expect(res.data.mentees[0]).toMatchObject({
      mentee: { id: mentee.id },
      contactStatus: 'REGULAR',
      lastContactKind: 'FOLLOW_UP',
      openTasks: 1,
      openPlans: 1,
      mainPlan: { id: plan.id, latest: 12, points: [8, 12] },
    });
    expect(res.data.upcoming.map((u: { id: string }) => u.id)).toContain(
      outing.id,
    );
    expect(res.data.mentor).toBeNull();
  });

  it('shows a mentor who is also a mentee their own mentor', async () => {
    const { mentor } = await story();
    const above = await createUser();
    await createMentorship(above.id, mentor.id);
    const res = await (await signedIn(mentor.id)).get('/api/dashboard/mentor');
    expect(res.data.mentor).toMatchObject({
      user: { id: above.id },
      lastContactAt: null,
      openPlans: 0,
    });
  });

  it("lists a member's history newest first, without private notes, in pages", async () => {
    const { mentee, asMentor } = await story();
    const res = await asMentor.get(`/api/feed?userId=${mentee.id}`);
    expect(res.status).toBe(200);
    expect(res.data.items.map((i: { kind: string }) => i.kind)).toEqual([
      'REPLY',
      'CHECK_IN',
      'FOLLOW_UP',
    ]);
    expect(res.data.items[2]).toMatchObject({
      planUpdates: 1,
      challenges: 1,
      tasks: 1,
    });
    // BR-NOTE-1: the feed never carries private notes, whoever reads it.
    expect(JSON.stringify(res.data)).not.toContain('e2e secret mentor note');
    // The upcoming activity isn't history yet.
    expect(
      res.data.items.some((i: { kind: string }) => i.kind === 'ACTIVITY'),
    ).toBe(false);

    const first = await asMentor.get(`/api/feed?userId=${mentee.id}&limit=2`);
    expect(first.data.items).toHaveLength(2);
    expect(first.data.nextCursor).toBe(first.data.items[1].at);
    const second = await asMentor.get(
      `/api/feed?userId=${mentee.id}&limit=2&before=${encodeURIComponent(first.data.nextCursor)}`,
    );
    expect(second.data.items.map((i: { kind: string }) => i.kind)).toEqual([
      'FOLLOW_UP',
    ]);
    expect(second.data.nextCursor).toBeNull();
  });

  it("refuses a member's history to someone who doesn't mentor them", async () => {
    const { mentee } = await story();
    const stranger = await signedIn((await createUser()).id);
    expect((await stranger.get(`/api/feed?userId=${mentee.id}`)).status).toBe(
      403,
    );
  });

  it("gives the mentee their tasks, plans, due check-ins and what's coming", async () => {
    const { mentor, mentee, asMentor, asMentee, outing } = await story();
    const quiet = (
      await asMentor.post('/api/plans', {
        menteeId: mentee.id,
        name: 'Morning walk',
        goal: '5 a week',
        trackingMethodId: methodId,
        target: 5,
      })
    ).data;
    await backdatePlan(quiet.id, 20);

    const res = await asMentee.get('/api/dashboard/journey');
    expect(res.status).toBe(200);
    expect(res.data.mentor.id).toBe(mentor.id);
    expect(res.data.tasks.map((t: { title: string }) => t.title)).toEqual([
      'Summarise a chapter',
    ]);
    const due = Object.fromEntries(
      res.data.plans.map((p: { name: string; checkInDue: boolean }) => [
        p.name,
        p.checkInDue,
      ]),
    );
    expect(due).toEqual({ 'Read daily': false, 'Morning walk': true });
    expect(res.data.upcoming).toEqual([
      expect.objectContaining({ id: outing.id, title: 'Football' }),
    ]);
  });
});
