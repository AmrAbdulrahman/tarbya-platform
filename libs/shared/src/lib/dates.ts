/** Organisation time zone (BR-ORG-3). The API can override it from ORG_TIMEZONE. */
export const ORG_TIMEZONE = 'Africa/Cairo';

export type CalendarPreference = 'GREGORIAN' | 'HIJRI' | 'BOTH';

export interface DateFormatOptions {
  locale: 'ar' | 'en';
  calendar?: CalendarPreference;
  timeZone?: string;
  /** Include the time of day. */
  withTime?: boolean;
}

function formatter(
  locale: 'ar' | 'en',
  calendar: 'gregory' | 'islamic-umalqura',
  timeZone: string,
  withTime: boolean,
) {
  // Latin digits in both languages, matching the designs.
  const tag = `${locale === 'ar' ? 'ar-EG' : 'en-GB'}-u-ca-${calendar}-nu-latn`;
  return new Intl.DateTimeFormat(tag, {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime
      ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
      : {}),
  });
}

/**
 * The one place dates are turned into text (BR-ORG-3, BR-ORG-4).
 * BOTH shows Gregorian first and Hijri after a separator.
 */
export function formatDate(
  date: Date | string,
  options: DateFormatOptions,
): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const {
    locale,
    calendar = 'GREGORIAN',
    timeZone = ORG_TIMEZONE,
    withTime = false,
  } = options;
  const gregorian = () =>
    formatter(locale, 'gregory', timeZone, withTime).format(value);
  const hijri = () =>
    formatter(locale, 'islamic-umalqura', timeZone, false).format(value);

  switch (calendar) {
    case 'HIJRI':
      return hijri();
    case 'BOTH':
      return `${gregorian()} · ${hijri()}`;
    default:
      return gregorian();
  }
}

/** The time of day, 24-hour, in the organisation zone. */
export function formatTime(
  date: Date | string,
  options: Pick<DateFormatOptions, 'locale' | 'timeZone'>,
): string {
  const { locale, timeZone = ORG_TIMEZONE } = options;
  return new Intl.DateTimeFormat(
    `${locale === 'ar' ? 'ar-EG' : 'en-GB'}-u-nu-latn`,
    { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  ).format(typeof date === 'string' ? new Date(date) : date);
}

/**
 * Day number and short month name for a calendar tile, in the user's calendar
 * (Hijri for HIJRI, Gregorian otherwise).
 */
export function formatDayTile(
  date: Date | string,
  options: DateFormatOptions,
): { day: string; month: string } {
  const { locale, calendar = 'GREGORIAN', timeZone = ORG_TIMEZONE } = options;
  const ca = calendar === 'HIJRI' ? 'islamic-umalqura' : 'gregory';
  const parts = new Intl.DateTimeFormat(
    `${locale === 'ar' ? 'ar-EG' : 'en-GB'}-u-ca-${ca}-nu-latn`,
    { timeZone, day: 'numeric', month: 'short' },
  ).formatToParts(typeof date === 'string' ? new Date(date) : date);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return { day: part('day'), month: part('month') };
}

/** Month and year, e.g. a monthly cycle. Cycles follow Gregorian months whatever the user's calendar. */
export function formatMonth(
  date: Date | string,
  options: Pick<DateFormatOptions, 'locale' | 'timeZone'>,
): string {
  const { locale, timeZone = ORG_TIMEZONE } = options;
  return new Intl.DateTimeFormat(
    `${locale === 'ar' ? 'ar-EG' : 'en-GB'}-u-ca-gregory-nu-latn`,
    { timeZone, month: 'long', year: 'numeric' },
  ).format(typeof date === 'string' ? new Date(date) : date);
}
