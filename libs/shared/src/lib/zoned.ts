import { ORG_TIMEZONE } from './dates.js';

/** A wall-clock date and time in a zone, as form inputs give them. */
export interface ZonedParts {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
}

/** The wall clock in `timeZone` at instant `at`. */
export function toZoned(at: Date, timeZone: string = ORG_TIMEZONE): ZonedParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    time: `${parts['hour']}:${parts['minute']}`,
  };
}

/** Milliseconds `timeZone` is ahead of UTC at instant `at`. */
function offsetAt(at: Date, timeZone: string): number {
  const { date, time } = toZoned(at, timeZone);
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

/**
 * The instant a wall-clock date and time in `timeZone` refers to (BR-ORG-3: times
 * are entered in the organisation zone and stored in UTC). Two passes, so a
 * daylight-saving change between the guess and the answer is handled.
 */
export function fromZoned(
  { date, time }: ZonedParts,
  timeZone: string = ORG_TIMEZONE,
): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  let instant = naive - offsetAt(new Date(naive), timeZone);
  instant = naive - offsetAt(new Date(instant), timeZone);
  return new Date(instant);
}
