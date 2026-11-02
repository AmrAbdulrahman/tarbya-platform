import { fromZoned, toZoned } from './zoned.js';

describe('zoned date and time', () => {
  it('reads Cairo wall-clock time in winter (UTC+2)', () => {
    expect(fromZoned({ date: '2026-11-01', time: '19:30' }).toISOString()).toBe(
      '2026-11-01T17:30:00.000Z',
    );
  });

  it('reads Cairo wall-clock time in summer daylight saving (UTC+3)', () => {
    expect(fromZoned({ date: '2026-07-15', time: '19:30' }).toISOString()).toBe(
      '2026-07-15T16:30:00.000Z',
    );
  });

  it('round-trips through toZoned', () => {
    const parts = { date: '2026-03-20', time: '08:05' };
    expect(toZoned(fromZoned(parts))).toEqual(parts);
  });

  it('gives the Cairo date for a UTC instant late in the evening', () => {
    expect(toZoned(new Date('2026-11-01T22:30:00Z'))).toEqual({
      date: '2026-11-02',
      time: '00:30',
    });
  });
});
