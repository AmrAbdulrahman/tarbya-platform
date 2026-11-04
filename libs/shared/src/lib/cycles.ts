import { trend, type Trend } from './trend.js';

/** How often a trackable is measured (BR-TRK-1). */
export type Cycle = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type TrackableType = 'COUNT' | 'BOOLEAN' | 'PERCENTAGE';

/** Only counts take a target; done/not done and percentages have a fixed scale (BR-TRK-1). */
export const takesTarget = (type: TrackableType) => type === 'COUNT';

/** Weeks run Saturday to Friday, as in the organisation's calendar. */
export const WEEK_STARTS_ON = 6;
/** How far back the mentee may fill a cycle they missed (BR-TRK-4). */
export const FILL_WINDOW_DAYS = 30;

// Days are 'YYYY-MM-DD' in the organisation zone; UTC midnight keeps the arithmetic exact.
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const asDay = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, days: number): string {
  const d = asDate(day);
  d.setUTCDate(d.getUTCDate() + days);
  return asDay(d);
}

/** The first day of the cycle that `day` falls in. */
export function cycleStart(day: string, cycle: Cycle): string {
  const d = asDate(day);
  if (cycle === 'WEEKLY') {
    return addDays(day, -((d.getUTCDay() - WEEK_STARTS_ON + 7) % 7));
  }
  if (cycle === 'MONTHLY') return `${day.slice(0, 7)}-01`;
  return day;
}

/** The first day of the cycle after the one starting on `start`. */
export function nextCycleStart(start: string, cycle: Cycle): string {
  if (cycle === 'DAILY') return addDays(start, 1);
  if (cycle === 'WEEKLY') return addDays(start, 7);
  const d = asDate(start);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return asDay(d);
}

/** The last day of the cycle starting on `start`. */
export function cycleEnd(start: string, cycle: Cycle): string {
  return addDays(nextCycleStart(start, cycle), -1);
}

/**
 * The day a cycle's log shows on: for a weekly cycle with a chosen weekday
 * (0 Sunday … 6 Saturday), that day of the week; otherwise its first day.
 */
export function logDay(
  start: string,
  cycle: Cycle,
  weekday: number | null | undefined,
): string {
  if (cycle !== 'WEEKLY' || weekday === null || weekday === undefined) {
    return start;
  }
  return addDays(start, (weekday - WEEK_STARTS_ON + 7) % 7);
}

/** Starts of every cycle from the one holding `from` to the one holding `to`, oldest first. */
export function cycleStarts(from: string, to: string, cycle: Cycle): string[] {
  const out: string[] = [];
  const last = cycleStart(to, cycle);
  for (
    let s = cycleStart(from, cycle);
    s <= last;
    s = nextCycleStart(s, cycle)
  ) {
    out.push(s);
  }
  return out;
}

export interface TrackableInput {
  cycle: Cycle;
  type: TrackableType;
  higherIsBetter: boolean;
  target: number | null;
  /** The day tracking began. */
  startsOn: string;
  /** The day it was archived, if it was: no cycles after that are expected. */
  archivedOn: string | null;
  /** Today in the organisation zone. */
  today: string;
  /** One per cycle, keyed by the cycle's first day. */
  entries: { periodStart: string; value: number }[];
  window: number;
  steadyBand: number;
}

export interface TrackableStats {
  /** The cycle today falls in. */
  currentCycle: string;
  logged: number;
  /** Cycles that have ended with nothing logged. */
  missed: number;
  /** Logged share of the cycles that have ended, or null before the first one ends. */
  rate: number | null;
  /** Cycles still worth filling: unlogged, and not ended more than FILL_WINDOW_DAYS ago. */
  openCycles: string[];
  trend: Trend;
  change: number;
  /** One value per cycle for the chart, oldest first, the last 12. */
  points: number[];
}

/**
 * Where a trackable stands (BR-TRK-2…5). Missed cycles count as "not done"
 * for done/not-done trackables and are left out of the others' trend.
 */
export function trackableStats(input: TrackableInput): TrackableStats {
  const { cycle } = input;
  const currentCycle = cycleStart(input.today, cycle);
  const until =
    input.archivedOn && input.archivedOn < input.today
      ? input.archivedOn
      : input.today;
  const all =
    input.startsOn <= until ? cycleStarts(input.startsOn, until, cycle) : [];
  const byCycle = new Map(input.entries.map((e) => [e.periodStart, e.value]));
  const ended = all.filter((s) => s < currentCycle);
  const missedCycles = ended.filter((s) => !byCycle.has(s));
  const fillFrom = addDays(input.today, -FILL_WINDOW_DAYS);
  const openCycles = input.archivedOn
    ? []
    : all.filter((s) => !byCycle.has(s) && cycleEnd(s, cycle) >= fillFrom);

  const series: number[] = [];
  for (const s of all) {
    const value = byCycle.get(s);
    if (value !== undefined) series.push(value);
    else if (input.type === 'BOOLEAN' && s < currentCycle) series.push(0);
  }
  const result = trend(series, {
    window: input.window,
    steadyBand: input.steadyBand,
    higherIsBetter: input.higherIsBetter,
    target:
      input.target ??
      (input.type === 'PERCENTAGE' ? 100 : input.type === 'BOOLEAN' ? 1 : 0),
  });
  return {
    currentCycle,
    logged: byCycle.size,
    missed: missedCycles.length,
    rate: ended.length
      ? (ended.length - missedCycles.length) / ended.length
      : null,
    openCycles,
    trend: result.trend,
    change: result.change,
    points: series.slice(-12),
  };
}
