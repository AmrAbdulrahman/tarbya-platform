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
