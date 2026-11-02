/** BR-FU-3: a follow-up or activity is upcoming until it starts; nobody sets it. */
export type InteractionStatus = 'UPCOMING' | 'DONE';

export function interactionStatus(
  startsAt: Date,
  now: Date,
): InteractionStatus {
  return startsAt.getTime() > now.getTime() ? 'UPCOMING' : 'DONE';
}

/** BR-FU-5: how long since a mentor last reached a mentee. */
export type ContactStatus = 'REGULAR' | 'DUE' | 'LATE';

const DAY = 86_400_000;

/**
 * `since` is the last done follow-up or activity, or the start of the mentorship
 * when there hasn't been one: a new mentee becomes due like anyone else.
 */
export function contactStatus(
  since: Date,
  now: Date,
  thresholds: { dueDays: number; lateDays: number },
): ContactStatus {
  const days = (now.getTime() - since.getTime()) / DAY;
  if (days >= thresholds.lateDays) return 'LATE';
  if (days >= thresholds.dueDays) return 'DUE';
  return 'REGULAR';
}

/** Whole days since `since`, for "3 days ago" labels. */
export function daysSince(since: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY));
}
