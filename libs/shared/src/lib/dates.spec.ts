import { formatDate, formatDayTile, formatMonth, formatTime } from './dates.js';

// 22:30 UTC on 1 Nov 2026 is already 2 Nov in Cairo (UTC+2).
const instant = '2026-11-01T22:30:00Z';

describe('formatDate', () => {
  it('uses the organisation time zone', () => {
    expect(formatDate(instant, { locale: 'en' })).toBe('2 November 2026');
  });

  it('formats Arabic with Latin digits', () => {
    expect(formatDate(instant, { locale: 'ar' })).toMatch(/^2 نوفمبر 2026$/);
  });

  it('formats the Hijri calendar', () => {
    expect(formatDate(instant, { locale: 'en', calendar: 'HIJRI' })).toMatch(
      /1448 AH$/,
    );
  });

  it('shows both calendars', () => {
    const text = formatDate(instant, { locale: 'en', calendar: 'BOTH' });
    expect(text.startsWith('2 November 2026 · ')).toBe(true);
    expect(text).toMatch(/AH$/);
  });

  it('can include the time', () => {
    expect(formatDate(instant, { locale: 'en', withTime: true })).toMatch(
      /00:30$/,
    );
  });
});

describe('formatTime', () => {
  it('shows the time in the organisation zone', () => {
    expect(formatTime(instant, { locale: 'en' })).toBe('00:30');
  });
});

describe('formatDayTile', () => {
  it('gives the day and short month in the organisation zone', () => {
    expect(formatDayTile(instant, { locale: 'en' })).toEqual({
      day: '2',
      month: 'Nov',
    });
  });

  it('uses the Hijri calendar when chosen', () => {
    const tile = formatDayTile(instant, { locale: 'en', calendar: 'HIJRI' });
    expect(tile.day).toMatch(/^\d{1,2}$/);
    expect(tile.month).not.toBe('Nov');
  });
});

describe('formatMonth', () => {
  it('names the month and year', () => {
    expect(formatMonth('2026-11-01T12:00:00Z', { locale: 'en' })).toBe(
      'November 2026',
    );
  });
});
