import {
  closeDb,
  createMentorship,
  createUser,
  signedIn,
} from '../support/fixtures';
import type { Session } from '../support/session';

afterAll(closeDb);

/** Today in the organisation zone, and days around it. */
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
    new Date(),
  );
const shift = (day: string, days: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

let admin: Session;

beforeAll(async () => {
  admin = await signedIn((await createUser({ moderator: true })).id);
});

async function pair() {
  const mentor = await createUser();
  const mentee = await createUser();
  await createMentorship(
    mentor.id,
    mentee.id,
    new Date(Date.now() - 60 * 86_400_000),
  );
  return {
    mentor,
    mentee,
    asMentor: await signedIn(mentor.id),
    asMentee: await signedIn(mentee.id),
  };
}

const daily = (menteeId: string, extra: Record<string, unknown> = {}) => ({
  menteeId,
  name: 'Read daily',
  goal: '20 pages',
  type: 'COUNT',
  cycle: 'DAILY',
  target: 20,
  ...extra,
});

describe('trackables (BR-TRK-1…6, US-4.5, US-5.2, US-4.7)', () => {
  it('lets the mentor create, edit, archive and restore; not the mentee', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    expect(
      (await asMentee.post('/api/trackables', daily(mentee.id))).status,
    ).toBe(403);

    const created = await asMentor.post('/api/trackables', daily(mentee.id));
    expect(created.status).toBe(200);
    expect(created.data).toMatchObject({
      name: 'Read daily',
      type: 'COUNT',
      cycle: 'DAILY',
      startsOn: today(),
      currentCycle: today(),
      openCycles: [today()],
      trend: 'NEW',
      canManage: true,
    });

    const edited = await asMentor.patch(`/api/trackables/${created.data.id}`, {
      target: 30,
      higherIsBetter: false,
    });
    expect(edited.data).toMatchObject({ target: 30, higherIsBetter: false });

    // Type and cycle can change until something is logged (BR-TRK-1).
    const reshaped = await asMentor.patch(
      `/api/trackables/${created.data.id}`,
      {
        cycle: 'MONTHLY',
      },
    );
    expect(reshaped.data).toMatchObject({
      cycle: 'MONTHLY',
      currentCycle: `${today().slice(0, 7)}-01`,
    });
    await asMentee.put(
      `/api/trackables/${created.data.id}/entries/${reshaped.data.currentCycle}`,
      { value: 4 },
    );
    expect(
      (
        await asMentor.patch(`/api/trackables/${created.data.id}`, {
          type: 'PERCENTAGE',
        })
      ).data.code,
    ).toBe('TRACKABLE_HAS_ENTRIES');

    const archived = await asMentor.patch(
      `/api/trackables/${created.data.id}`,
      { archived: true },
    );
    expect(archived.data).toMatchObject({ openCycles: [], canLog: false });
    const blocked = await asMentee.put(
      `/api/trackables/${created.data.id}/entries/${today()}`,
      { value: 3 },
    );
    expect(blocked.data.code).toBe('TRACKABLE_ARCHIVED');
    const restored = await asMentor.patch(
      `/api/trackables/${created.data.id}`,
      { archived: false },
    );
    expect(restored.data.archivedAt).toBeNull();
  });

  it('shows a weekly log on a chosen weekday, changeable after logging (BR-TRK-1)', async () => {
    const { mentee, asMentor } = await pair();
    const created = await asMentor.post(
      '/api/trackables',
      daily(mentee.id, { cycle: 'WEEKLY', weekday: 5 }),
    );
    expect(created.data).toMatchObject({ cycle: 'WEEKLY', weekday: 5 });
    await asMentor.put(
      `/api/trackables/${created.data.id}/entries/${created.data.currentCycle}`,
      { value: 3 },
    );
    // Only where the log shows, so it still changes once something is logged.
    const moved = await asMentor.patch(`/api/trackables/${created.data.id}`, {
      weekday: null,
    });
    expect(moved.data.weekday).toBeNull();
    expect(
      (
        await asMentor.patch(`/api/trackables/${created.data.id}`, {
          weekday: 7,
        })
      ).status,
    ).toBe(400);

    // Other cycles have no weekday.
    const dailyOne = await asMentor.post(
      '/api/trackables',
      daily(mentee.id, { weekday: 2 }),
    );
    expect(dailyOne.data.weekday).toBeNull();
  });

  it('offers the mentee the last 30 days to fill, and counts what they missed', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const tr = (
      await asMentor.post(
        '/api/trackables',
        daily(mentee.id, { startsOn: shift(today(), -40) }),
      )
    ).data;
    // 40 days ended with nothing logged; 30 of them, and today, can still be filled.
    expect(tr.missed).toBe(40);
    expect(tr.openCycles[0]).toBe(shift(today(), -30));
    expect(tr.openCycles.at(-1)).toBe(today());

    const logged = await asMentee.put(
      `/api/trackables/${tr.id}/entries/${shift(today(), -1)}`,
      { value: 12, note: 'Good day', needsHelp: true },
    );
    expect(logged.status).toBe(200);
    expect(logged.data).toMatchObject({ logged: 1, missed: 39, latest: 12 });
    expect(logged.data.entries[0]).toMatchObject({
      periodStart: shift(today(), -1),
      source: 'MENTEE',
      needsHelp: true,
      note: 'Good day',
    });
    expect(logged.data.openCycles).not.toContain(shift(today(), -1));

    // Logging the same cycle again replaces it.
    const again = await asMentee.put(
      `/api/trackables/${tr.id}/entries/${shift(today(), -1)}`,
      { value: 14 },
    );
    expect(again.data).toMatchObject({ logged: 1, latest: 14 });

    // Older than 30 days: the mentee can't; the mentor can.
    const old = shift(today(), -35);
    expect(
      (
        await asMentee.put(`/api/trackables/${tr.id}/entries/${old}`, {
          value: 1,
        })
      ).data.code,
    ).toBe('CYCLE_OUT_OF_RANGE');
    const byMentor = await asMentor.put(
      `/api/trackables/${tr.id}/entries/${old}`,
      { value: 1 },
    );
    expect(byMentor.data.entries.at(-1)).toMatchObject({
      periodStart: old,
      source: 'MENTOR',
    });
    // Before it started: the start moves back to that cycle.
    const earlier = await asMentor.put(
      `/api/trackables/${tr.id}/entries/${shift(today(), -42)}`,
      { value: 3 },
    );
    expect(earlier.data).toMatchObject({ startsOn: shift(today(), -42) });
    // Not in the future, not a bad day.
    expect(
      (
        await asMentor.put(
          `/api/trackables/${tr.id}/entries/${shift(today(), 1)}`,
          { value: 1 },
        )
      ).data.code,
    ).toBe('CYCLE_OUT_OF_RANGE');
    expect(
      (
        await asMentor.put(`/api/trackables/${tr.id}/entries/not-a-day`, {
          value: 1,
        })
      ).status,
    ).toBe(400);
  });

  it('checks values against the type and cycles against their start', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const done = (
      await asMentor.post(
        '/api/trackables',
        daily(mentee.id, { type: 'BOOLEAN', target: null }),
      )
    ).data;
    expect(
      (
        await asMentee.put(`/api/trackables/${done.id}/entries/${today()}`, {
          value: 2,
        })
      ).data.errors,
    ).toHaveProperty('value');
    expect(
      (
        await asMentee.put(`/api/trackables/${done.id}/entries/${today()}`, {
          value: 1,
        })
      ).status,
    ).toBe(200);

    const pct = (
      await asMentor.post(
        '/api/trackables',
        daily(mentee.id, { type: 'PERCENTAGE', target: 80 }),
      )
    ).data;
    expect(
      (
        await asMentee.put(`/api/trackables/${pct.id}/entries/${today()}`, {
          value: 101,
        })
      ).status,
    ).toBe(400);

    // A weekly cycle is keyed by its Saturday.
    const weekly = (
      await asMentor.post(
        '/api/trackables',
        daily(mentee.id, { cycle: 'WEEKLY' }),
      )
    ).data;
    const notSaturday = [0, 1, 2, 3, 4, 5, 6]
      .map((n) => shift(weekly.currentCycle, n))
      .find((d) => d !== weekly.currentCycle) as string;
    expect(
      (
        await asMentee.put(
          `/api/trackables/${weekly.id}/entries/${notSaturday}`,
          { value: 1 },
        )
      ).data.errors,
    ).toHaveProperty('periodStart');
    expect(
      (
        await asMentee.put(
          `/api/trackables/${weekly.id}/entries/${weekly.currentCycle}`,
          { value: 1 },
        )
      ).status,
    ).toBe(200);
  });

  it('logs the current cycle from a follow-up; not for upcoming follow-ups or other mentees', async () => {
    const a = await pair();
    const b = await pair();
    const ofA = (await a.asMentor.post('/api/trackables', daily(a.mentee.id)))
      .data;
    const ofB = (await b.asMentor.post('/api/trackables', daily(b.mentee.id)))
      .data;

    const followUp = await a.asMentor.post('/api/interactions/follow-ups', {
      menteeId: a.mentee.id,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      trackableUpdates: [{ trackableId: ofA.id, value: 9, note: 'Together' }],
    });
    expect(followUp.status).toBe(200);
    const after = (await a.asMentee.get(`/api/trackables/${ofA.id}`)).data;
    expect(after.entries[0]).toMatchObject({
      periodStart: today(),
      value: 9,
      source: 'MENTOR',
    });

    const foreign = await a.asMentor.post('/api/interactions/follow-ups', {
      menteeId: a.mentee.id,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      trackableUpdates: [{ trackableId: ofB.id, value: 1 }],
    });
    expect(foreign.data.errors).toHaveProperty('trackableUpdates');
    const future = await a.asMentor.post('/api/interactions/follow-ups', {
      menteeId: a.mentee.id,
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      trackableUpdates: [{ trackableId: ofA.id, value: 1 }],
    });
    expect(future.data.errors).toHaveProperty('trackableUpdates');
  });

  it("lets the mentor reply to the mentee's entry; the reply shows with it", async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const tr = (await asMentor.post('/api/trackables', daily(mentee.id))).data;
    const entry = (
      await asMentee.put(`/api/trackables/${tr.id}/entries/${today()}`, {
        value: 1,
      })
    ).data.entries[0];
    expect(
      (
        await asMentee.post(`/api/trackables/entries/${entry.id}/replies`, {
          body: 'x',
        })
      ).status,
    ).toBe(403);
    const replied = await asMentor.post(
      `/api/trackables/entries/${entry.id}/replies`,
      { body: 'Keep going' },
    );
    expect(replied.data.entries[0].replies).toEqual([
      expect.objectContaining({ body: 'Keep going' }),
    ]);
  });

  it('keeps trackables to the mentee, their mentor and admins', async () => {
    const { mentee, asMentor } = await pair();
    const tr = (await asMentor.post('/api/trackables', daily(mentee.id))).data;
    const stranger = await signedIn((await createUser()).id);
    expect(
      (await stranger.get(`/api/trackables?menteeId=${mentee.id}`)).status,
    ).toBe(403);
    expect((await stranger.get(`/api/trackables/${tr.id}`)).status).toBe(403);
    expect(
      (
        await stranger.put(`/api/trackables/${tr.id}/entries/${today()}`, {
          value: 1,
        })
      ).status,
    ).toBe(403);
    expect((await admin.get(`/api/trackables/${tr.id}`)).data.canManage).toBe(
      true,
    );
  });

  it('lists entries of every trackable for cycles in a period (US-4.2)', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const start = shift(today(), -10);
    const read = (
      await asMentor.post(
        '/api/trackables',
        daily(mentee.id, { startsOn: start }),
      )
    ).data;
    const walk = (
      await asMentor.post(
        '/api/trackables',
        daily(mentee.id, {
          name: 'Walk',
          type: 'BOOLEAN',
          target: null,
          startsOn: start,
        }),
      )
    ).data;
    await asMentor.put(
      `/api/trackables/${read.id}/entries/${shift(today(), -8)}`,
      { value: 5 },
    );
    await asMentor.put(
      `/api/trackables/${read.id}/entries/${shift(today(), -1)}`,
      { value: 9, note: 'Good' },
    );
    await asMentor.put(`/api/trackables/${walk.id}/entries/${today()}`, {
      value: 1,
    });

    const res = await asMentee.get(
      `/api/trackables/entries?menteeId=${mentee.id}&from=${shift(today(), -2)}&to=${today()}`,
    );
    expect(res.status).toBe(200);
    expect(
      res.data.map(
        (e: { trackableId: string; periodStart: string; value: number }) => [
          e.trackableId,
          e.periodStart,
          e.value,
        ],
      ),
    ).toEqual([
      [walk.id, today(), 1],
      [read.id, shift(today(), -1), 9],
    ]);
    expect(res.data[1]).toMatchObject({
      note: 'Good',
      author: expect.any(Object),
    });

    const stranger = await signedIn((await createUser()).id);
    expect(
      (
        await stranger.get(
          `/api/trackables/entries?menteeId=${mentee.id}&from=${today()}&to=${today()}`,
        )
      ).status,
    ).toBe(403);
    // At most a year, and from before to.
    expect(
      (
        await asMentor.get(
          `/api/trackables/entries?menteeId=${mentee.id}&from=${today()}&to=${shift(today(), -1)}`,
        )
      ).status,
    ).toBe(400);
  });
});
