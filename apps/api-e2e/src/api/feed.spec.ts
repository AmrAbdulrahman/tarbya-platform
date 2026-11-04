import {
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
let outingId: string;

beforeAll(async () => {
  admin = await signedIn((await createUser({ moderator: true })).id);
  outingId = (
    await admin.post('/api/lookups/activity-types', {
      nameAr: 'نزهة',
      nameEn: 'e2e Feed outing',
      scope: 'INDIVIDUAL',
    })
  ).data.id;
});

/** Yesterday in the organisation zone. */
const yesterday = () => {
  const d = new Date(
    `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}T00:00:00Z`,
  );
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * A mentor and mentee with a daily trackable: the mentee logged yesterday and
 * got a reply, a done follow-up logged today, plus an upcoming activity.
 */
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
  const trackable = (
    await asMentor.post('/api/trackables', {
      menteeId: mentee.id,
      name: 'Read daily',
      type: 'COUNT',
      cycle: 'DAILY',
      target: 20,
      startsOn: yesterday(),
    })
  ).data;
  const entry = (
    await asMentee.put(
      `/api/trackables/${trackable.id}/entries/${yesterday()}`,
      { value: 12, note: 'Better day' },
    )
  ).data.entries[0];
  await asMentor.post(`/api/trackables/entries/${entry.id}/replies`, {
    body: 'Keep going',
  });
  const followUp = await asMentor.post('/api/interactions/follow-ups', {
    menteeId: mentee.id,
    startsAt: minutesFromNow(-1),
    privateNotes: 'e2e secret mentor note',
    challenges: ['exams'],
    tasks: [{ title: 'Summarise a chapter' }],
    trackableUpdates: [{ trackableId: trackable.id, value: 8 }],
  });
  expect(followUp.status).toBe(200);
  const outing = await asMentor.post('/api/interactions/activities', {
    activityTypeId: outingId,
    title: 'Football',
    participantIds: [mentee.id],
    startsAt: minutesFromNow(60 * 24),
  });
  expect(outing.status).toBe(200);
  return { mentor, mentee, asMentor, asMentee, trackable, outing: outing.data };
}

describe('feed and dashboards (US-4.1, US-4.2, US-5.1)', () => {
  it('gives the mentor their mentees, stats, upcoming items and trackables', async () => {
    const { mentee, asMentor, trackable, outing } = await story();
    const res = await asMentor.get('/api/dashboard/mentor');
    expect(res.status).toBe(200);
    expect(res.data.stats).toMatchObject({
      mentees: 1,
      needContact: 0,
      activeTrackables: 1,
    });
    expect(res.data.stats.monthFollowUps).toBeGreaterThanOrEqual(1);
    expect(res.data.mentees[0]).toMatchObject({
      mentee: { id: mentee.id },
      contactStatus: 'REGULAR',
      lastContactKind: 'FOLLOW_UP',
      openTasks: 1,
      activeTrackables: 1,
      openChallenges: 1,
      mainTrackable: { id: trackable.id, latest: 8, points: [12, 8] },
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
      activeTrackables: 0,
    });
  });

  it("lists a member's history newest first, without private notes, in pages", async () => {
    const { mentee, asMentor } = await story();
    const res = await asMentor.get(`/api/feed?userId=${mentee.id}`);
    expect(res.status).toBe(200);
    expect(res.data.items.map((i: { kind: string }) => i.kind)).toEqual([
      'REPLY',
      'ENTRY',
      'FOLLOW_UP',
    ]);
    expect(res.data.items[2]).toMatchObject({
      trackableUpdates: 1,
      challenges: ['exams'],
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

  it("gives the mentee their tasks, trackables, cycles to log and what's coming", async () => {
    const { mentor, mentee, asMentor, asMentee, outing } = await story();
    await asMentor.post('/api/trackables', {
      menteeId: mentee.id,
      name: 'Morning walk',
      type: 'BOOLEAN',
      cycle: 'DAILY',
    });

    const res = await asMentee.get('/api/dashboard/journey');
    expect(res.status).toBe(200);
    expect(res.data.mentor.id).toBe(mentor.id);
    expect(res.data.tasks.map((t: { title: string }) => t.title)).toEqual([
      'Summarise a chapter',
    ]);
    const waiting = Object.fromEntries(
      res.data.trackables.map((x: { name: string; openCycles: string[] }) => [
        x.name,
        x.openCycles.length,
      ]),
    );
    // Both days of "Read daily" are logged; today's walk isn't yet.
    expect(waiting).toEqual({ 'Read daily': 0, 'Morning walk': 1 });
    expect(res.data.upcoming).toEqual([
      expect.objectContaining({ id: outing.id, title: 'Football' }),
    ]);
  });
});
