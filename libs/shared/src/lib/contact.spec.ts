import { contactStatus, daysSince, interactionStatus } from './contact.js';

const now = new Date('2026-11-02T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
const thresholds = { dueDays: 7, lateDays: 14 };

describe('interactionStatus', () => {
  it('is upcoming until it starts', () => {
    expect(interactionStatus(new Date(now.getTime() + 1), now)).toBe(
      'UPCOMING',
    );
    expect(interactionStatus(now, now)).toBe('DONE');
  });
});

describe('contactStatus', () => {
  it('is regular before the due threshold', () => {
    expect(contactStatus(ago(6.9), now, thresholds)).toBe('REGULAR');
  });

  it('is due from the due threshold and late from the late one', () => {
    expect(contactStatus(ago(7), now, thresholds)).toBe('DUE');
    expect(contactStatus(ago(13.9), now, thresholds)).toBe('DUE');
    expect(contactStatus(ago(14), now, thresholds)).toBe('LATE');
  });
});

describe('daysSince', () => {
  it('counts whole days and never goes negative', () => {
    expect(daysSince(ago(3.5), now)).toBe(3);
    expect(daysSince(new Date(now.getTime() + 5000), now)).toBe(0);
  });
});
