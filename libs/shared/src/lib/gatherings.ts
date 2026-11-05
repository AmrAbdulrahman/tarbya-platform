import { addDays } from './cycles.js';
import { ORG_TIMEZONE } from './dates.js';
import { fromZoned } from './zoned.js';

/** A recurring gathering's schedule (BR-GRP-5), in organisation wall-clock time. */
export interface SeriesSchedule {
  /** 0 Sunday … 6 Saturday. */
  weekday: number;
  /** HH:mm */
  time: string;
  intervalWeeks: number;
  /** YYYY-MM-DD */
  startsOn: string;
  /** YYYY-MM-DD; the last day an occurrence may fall on. */
  endsOn?: string | null;
}

/** How many weeks ahead occurrences are created, so RSVPs and attendance attach to real rows. */
export const MATERIALISE_WEEKS = 8;

const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/**
 * The instants a series falls on between `from` and `to` (inclusive): the first
 * `weekday` on or after `startsOn`, then every `intervalWeeks` weeks after it.
 */
export function seriesOccurrences(
  schedule: SeriesSchedule,
  from: Date,
  to: Date,
  timeZone: string = ORG_TIMEZONE,
): Date[] {
  const step = 7 * Math.max(1, schedule.intervalWeeks);
  let day = addDays(
    schedule.startsOn,
    (schedule.weekday - weekdayOf(schedule.startsOn) + 7) % 7,
  );
  const out: Date[] = [];
  for (;;) {
    if (schedule.endsOn && day > schedule.endsOn) break;
    const at = fromZoned({ date: day, time: schedule.time }, timeZone);
    if (at > to) break;
    if (at >= from) out.push(at);
    day = addDays(day, step);
  }
  return out;
}

export type ReminderLead = 'NONE' | 'H3' | 'H24' | 'H48';

const LEAD_HOURS: Record<ReminderLead, number | null> = {
  NONE: null,
  H3: 3,
  H24: 24,
  H48: 48,
};

export interface GatheringNoticeInput {
  startsAt: Date;
  requiresRsvp: boolean;
  /** The gathering type's own reminder lead. */
  reminder: ReminderLead;
  rsvpRequestedAt: Date | null;
  remindedAt: Date | null;
}

/**
 * What a gathering is owed at `now` (BR-GRP-7, US-6.5): the RSVP request
 * `rsvpRequestHours` before it starts, then one reminder at the type's lead
 * time, or at `reminderHours` for RSVP types without one. Nothing once it started.
 */
export function gatheringNotices(
  g: GatheringNoticeInput,
  now: Date,
  settings: { rsvpRequestHours: number; reminderHours: number },
): { request: boolean; remind: boolean } {
  const hoursLeft = (g.startsAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft <= 0) return { request: false, remind: false };
  const request =
    g.requiresRsvp &&
    !g.rsvpRequestedAt &&
    hoursLeft <= settings.rsvpRequestHours;
  const lead =
    LEAD_HOURS[g.reminder] ?? (g.requiresRsvp ? settings.reminderHours : null);
  const remind = lead !== null && !g.remindedAt && hoursLeft <= lead;
  return { request, remind };
}
