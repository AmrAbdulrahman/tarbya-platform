import {
  cycleEnd,
  cycleStart,
  cycleStarts,
  logDay,
  nextCycleStart,
  trackableStats,
  type TrackableInput,
} from './cycles.js';

describe('cycles', () => {
  it('finds the start of a day, week (Saturday) and month', () => {
    // Tuesday 3 November 2026.
    expect(cycleStart('2026-11-03', 'DAILY')).toBe('2026-11-03');
    expect(cycleStart('2026-11-03', 'WEEKLY')).toBe('2026-10-31');
    expect(cycleStart('2026-10-31', 'WEEKLY')).toBe('2026-10-31');
    expect(cycleStart('2026-11-06', 'WEEKLY')).toBe('2026-10-31');
    expect(cycleStart('2026-11-03', 'MONTHLY')).toBe('2026-11-01');
  });

  it("puts a weekly cycle's log on its chosen weekday", () => {
    // The week of Saturday 31 October 2026.
    expect(logDay('2026-10-31', 'WEEKLY', null)).toBe('2026-10-31');
    expect(logDay('2026-10-31', 'WEEKLY', 6)).toBe('2026-10-31');
    expect(logDay('2026-10-31', 'WEEKLY', 0)).toBe('2026-11-01');
    expect(logDay('2026-10-31', 'WEEKLY', 5)).toBe('2026-11-06');
    expect(logDay('2026-11-01', 'MONTHLY', 5)).toBe('2026-11-01');
  });

  it('steps to the next cycle and knows where one ends', () => {
    expect(nextCycleStart('2026-12-31', 'DAILY')).toBe('2027-01-01');
    expect(nextCycleStart('2026-10-31', 'WEEKLY')).toBe('2026-11-07');
    expect(nextCycleStart('2026-01-01', 'MONTHLY')).toBe('2026-02-01');
    expect(cycleEnd('2026-02-01', 'MONTHLY')).toBe('2026-02-28');
    expect(cycleEnd('2026-10-31', 'WEEKLY')).toBe('2026-11-06');
  });

  it('lists the cycles between two days', () => {
    expect(cycleStarts('2026-10-20', '2026-11-03', 'WEEKLY')).toEqual([
      '2026-10-17',
      '2026-10-24',
      '2026-10-31',
    ]);
  });
});

const base: TrackableInput = {
  cycle: 'DAILY',
  type: 'COUNT',
  higherIsBetter: true,
  target: 10,
  startsOn: '2026-10-01',
  archivedOn: null,
  today: '2026-11-03',
  entries: [],
  window: 3,
  steadyBand: 0.05,
};

describe('trackableStats', () => {
  it('counts missed cycles since the start, but offers only the last 30 days to fill', () => {
    const stats = trackableStats({
      ...base,
      entries: [{ periodStart: '2026-11-02', value: 4 }],
    });
    // 1 Oct … 2 Nov have ended: 33 days, one logged.
    expect(stats.missed).toBe(32);
    expect(stats.logged).toBe(1);
    expect(stats.rate).toBeCloseTo(1 / 33);
    expect(stats.currentCycle).toBe('2026-11-03');
    expect(stats.openCycles[0]).toBe('2026-10-04');
    expect(stats.openCycles).not.toContain('2026-11-02');
    expect(stats.openCycles.at(-1)).toBe('2026-11-03');
  });

  it('counts a missed cycle as not done for a done/not-done trackable', () => {
    const stats = trackableStats({
      ...base,
      type: 'BOOLEAN',
      target: null,
      startsOn: '2026-10-28',
      entries: [
        { periodStart: '2026-10-28', value: 1 },
        { periodStart: '2026-10-29', value: 1 },
        { periodStart: '2026-10-30', value: 1 },
      ],
    });
    expect(stats.points).toEqual([1, 1, 1, 0, 0, 0]);
    expect(stats.trend).toBe('WORSE');
  });

  it('leaves missed cycles out of a count trend', () => {
    const stats = trackableStats({
      ...base,
      startsOn: '2026-10-28',
      entries: [
        { periodStart: '2026-10-28', value: 2 },
        { periodStart: '2026-10-30', value: 6 },
      ],
    });
    expect(stats.points).toEqual([2, 6]);
    expect(stats.trend).toBe('IMPROVING');
  });

  it('expects nothing after archiving', () => {
    const stats = trackableStats({
      ...base,
      startsOn: '2026-10-28',
      archivedOn: '2026-10-30',
    });
    expect(stats.missed).toBe(3);
    expect(stats.openCycles).toEqual([]);
  });
});
