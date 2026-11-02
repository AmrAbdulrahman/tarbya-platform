import {
  closeDb,
  createMentorship,
  createUser,
  signedIn,
} from '../support/fixtures';
import type { Session } from '../support/session';

afterAll(closeDb);

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

let admin: Session;
let methodId: string;

beforeAll(async () => {
  admin = await signedIn((await createUser({ moderator: true })).id);
  methodId = (
    await admin.post('/api/lookups/tracking-methods', {
      nameAr: 'عدد',
      nameEn: 'e2e Count',
    })
  ).data.id;
});

async function pair() {
  const mentor = await createUser();
  const mentee = await createUser();
  await createMentorship(
    mentor.id,
    mentee.id,
    new Date(Date.now() - 30 * 86_400_000),
  );
  return {
    mentor,
    mentee,
    asMentor: await signedIn(mentor.id),
    asMentee: await signedIn(mentee.id),
  };
}

const planBody = (menteeId: string) => ({
  menteeId,
  name: 'Memorise Juz Amma',
  goal: '37 surahs',
  trackingMethodId: methodId,
  target: 10,
  endsOn: '2026-12-30',
});

describe('development plans (US-4.5, US-5.2, US-4.7, BR-PLAN-1…5)', () => {
  it('lets the mentor create, edit, close and reopen; not the mentee', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    expect(
      (await asMentee.post('/api/plans', planBody(mentee.id))).status,
    ).toBe(403);

    const created = await asMentor.post('/api/plans', planBody(mentee.id));
    expect(created.status).toBe(200);
    expect(created.data).toMatchObject({
      name: 'Memorise Juz Amma',
      endsOn: '2026-12-30',
      trend: 'NEW',
      latest: null,
      canManage: true,
      canCheckIn: false,
    });

    const edited = await asMentor.patch(`/api/plans/${created.data.id}`, {
      target: 37,
      higherIsBetter: true,
    });
    expect(edited.data.target).toBe(37);
    const closedPlan = await asMentor.patch(`/api/plans/${created.data.id}`, {
      closed: true,
    });
    expect(closedPlan.data.closedAt).not.toBeNull();
    const blocked = await asMentee.post(
      `/api/plans/${created.data.id}/check-ins`,
      { value: 3 },
    );
    expect(blocked.data.code).toBe('PLAN_CLOSED');
    const reopened = await asMentor.patch(`/api/plans/${created.data.id}`, {
      closed: false,
    });
    expect(reopened.data.closedAt).toBeNull();

    const inactive = await admin.post('/api/lookups/tracking-methods', {
      nameAr: 'قديم',
      nameEn: 'e2e Old',
      active: false,
    });
    const bad = await asMentor.post('/api/plans', {
      ...planBody(mentee.id),
      trackingMethodId: inactive.data.id,
    });
    expect(bad.data.code).toBe('TRACKING_METHOD_INVALID');
  });

  it('records readings from follow-ups and check-ins, and works out the trend', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const plan = (await asMentor.post('/api/plans', planBody(mentee.id))).data;

    const followUp = await asMentor.post('/api/interactions/follow-ups', {
      menteeId: mentee.id,
      startsAt: daysAgo(7),
      planUpdates: [{ planId: plan.id, value: 2, note: 'Started' }],
    });
    expect(followUp.status).toBe(200);

    const checkIn = await asMentee.post(`/api/plans/${plan.id}/check-ins`, {
      value: 5,
      note: 'Three more',
      needsHelp: true,
    });
    expect(checkIn.data).toMatchObject({
      latest: 5,
      trend: 'IMPROVING',
      change: 3,
      points: [2, 5],
    });
    expect(checkIn.data.readings[0]).toMatchObject({
      source: 'CHECK_IN',
      needsHelp: true,
      note: 'Three more',
    });
    // The follow-up's reading is dated at the follow-up.
    expect(checkIn.data.readings[1]).toMatchObject({
      source: 'FOLLOW_UP',
      value: 2,
    });
    expect(Date.parse(checkIn.data.readings[1].recordedAt)).toBeLessThan(
      Date.now() - 6 * 86_400_000,
    );

    // The mentee checks in on their own plans only; the mentor doesn't.
    expect(
      (await asMentor.post(`/api/plans/${plan.id}/check-ins`, { value: 1 }))
        .status,
    ).toBe(403);

    const list = (await asMentee.get(`/api/plans?menteeId=${mentee.id}`)).data;
    expect(list[0]).toMatchObject({ id: plan.id, trend: 'IMPROVING' });
  });

  it('refuses plan updates for upcoming follow-ups and for someone else’s plans', async () => {
    const a = await pair();
    const b = await pair();
    const planOfB = (await b.asMentor.post('/api/plans', planBody(b.mentee.id)))
      .data;
    const planOfA = (await a.asMentor.post('/api/plans', planBody(a.mentee.id)))
      .data;

    const foreign = await a.asMentor.post('/api/interactions/follow-ups', {
      menteeId: a.mentee.id,
      startsAt: daysAgo(1),
      planUpdates: [{ planId: planOfB.id, value: 1 }],
    });
    expect(foreign.data.errors).toHaveProperty('planUpdates');

    const future = await a.asMentor.post('/api/interactions/follow-ups', {
      menteeId: a.mentee.id,
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      planUpdates: [{ planId: planOfA.id, value: 1 }],
    });
    expect(future.data.errors).toHaveProperty('planUpdates');
  });

  it('lets the mentor reply to a check-in; the reply shows in the history (BR-PLAN-5)', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const plan = (await asMentor.post('/api/plans', planBody(mentee.id))).data;
    const reading = (
      await asMentee.post(`/api/plans/${plan.id}/check-ins`, { value: 1 })
    ).data.readings[0];

    expect(
      (
        await asMentee.post(`/api/plans/readings/${reading.id}/replies`, {
          body: 'x',
        })
      ).status,
    ).toBe(403);
    const replied = await asMentor.post(
      `/api/plans/readings/${reading.id}/replies`,
      { body: 'Split it over weeks' },
    );
    expect(replied.data.readings[0].replies).toEqual([
      expect.objectContaining({ body: 'Split it over weeks' }),
    ]);
    expect(
      (await asMentee.get(`/api/plans/${plan.id}`)).data.readings[0].replies,
    ).toHaveLength(1);
  });

  it('keeps plans to the mentee, their mentor and admins', async () => {
    const { mentee, asMentor } = await pair();
    const plan = (await asMentor.post('/api/plans', planBody(mentee.id))).data;
    const stranger = await signedIn((await createUser()).id);
    expect(
      (await stranger.get(`/api/plans?menteeId=${mentee.id}`)).status,
    ).toBe(403);
    expect((await stranger.get(`/api/plans/${plan.id}`)).status).toBe(403);
    expect((await admin.get(`/api/plans/${plan.id}`)).data.canManage).toBe(
      true,
    );
  });
});
