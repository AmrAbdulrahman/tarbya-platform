import { gatheringNotices, seriesOccurrences } from './gatherings.js';

describe('seriesOccurrences (BR-GRP-5)', () => {
  const weekly = {
    weekday: 2, // Tuesday
    time: '20:00',
    intervalWeeks: 1,
    startsOn: '2026-11-01', // a Sunday
  };

  it('starts on the first matching weekday and repeats weekly in Cairo time', () => {
    const at = seriesOccurrences(
      weekly,
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-11-20T00:00:00Z'),
    );
    // Cairo is UTC+2 in November.
    expect(at.map((d) => d.toISOString())).toEqual([
      '2026-11-03T18:00:00.000Z',
      '2026-11-10T18:00:00.000Z',
      '2026-11-17T18:00:00.000Z',
    ]);
  });

  it('skips weeks for a fortnightly series and keeps its rhythm from the start', () => {
    const at = seriesOccurrences(
      { ...weekly, intervalWeeks: 2 },
      new Date('2026-11-05T00:00:00Z'),
      new Date('2026-12-05T00:00:00Z'),
    );
    expect(at.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-11-17',
      '2026-12-01',
    ]);
  });

  it('stops after endsOn', () => {
    const at = seriesOccurrences(
      { ...weekly, endsOn: '2026-11-10' },
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-12-31T00:00:00Z'),
    );
    expect(at).toHaveLength(2);
  });
});

describe('gatheringNotices (BR-GRP-7, US-6.5)', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);
  const settings = { rsvpRequestHours: 48, reminderHours: 3 };
  const base = {
    requiresRsvp: true,
    reminder: 'NONE' as const,
    rsvpRequestedAt: null,
    remindedAt: null,
  };

  it('asks for an RSVP inside the request window, once', () => {
    expect(
      gatheringNotices({ ...base, startsAt: inHours(72) }, now, settings),
    ).toEqual({ request: false, remind: false });
    expect(
      gatheringNotices({ ...base, startsAt: inHours(40) }, now, settings)
        .request,
    ).toBe(true);
    expect(
      gatheringNotices(
        { ...base, startsAt: inHours(40), rsvpRequestedAt: now },
        now,
        settings,
      ).request,
    ).toBe(false);
  });

  it('reminds at the type lead, or the setting for RSVP types without one', () => {
    expect(
      gatheringNotices({ ...base, startsAt: inHours(2) }, now, settings).remind,
    ).toBe(true);
    expect(
      gatheringNotices(
        {
          ...base,
          requiresRsvp: false,
          reminder: 'H24',
          startsAt: inHours(20),
        },
        now,
        settings,
      ),
    ).toEqual({ request: false, remind: true });
    expect(
      gatheringNotices(
        { ...base, requiresRsvp: false, startsAt: inHours(1) },
        now,
        settings,
      ).remind,
    ).toBe(false);
  });

  it('owes nothing once the gathering has started', () => {
    expect(
      gatheringNotices({ ...base, startsAt: inHours(-1) }, now, settings),
    ).toEqual({ request: false, remind: false });
  });
});
