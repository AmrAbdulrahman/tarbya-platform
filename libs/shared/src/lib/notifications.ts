/**
 * Notification types (BR-NTF-3). Each is delivered in-app and by email as the
 * user chooses (BR-NTF-1); mandatory ones can't be switched off in-app.
 */
export const NOTIFICATION_TYPES = [
  'MENTORSHIP_ASSIGNED',
  'MENTORSHIP_ENDED',
  'INTERACTION_SCHEDULED',
  'INTERACTION_CHANGED',
  'CONTACT_DUE',
  'CONTACT_LATE',
  'GATHERING_RSVP_REQUEST',
  'GATHERING_REMINDER',
  'TRACKABLE_CREATED',
  'TRACKABLE_CHANGED',
  'CYCLE_WAITING',
  'ENTRY_LOGGED',
  'CHALLENGE_RAISED',
  'CHALLENGE_COMMENTED',
  'CHALLENGE_RESOLVED',
  'MENTOR_REPLIED',
  'TASK_ASSIGNED',
  'NEW_MESSAGE',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Which filter of the notification centre (US-7.1) a type falls under. */
export type NotificationCategory = 'mentees' | 'journey' | 'groups' | 'other';

export const NOTIFICATION_CATEGORY: Record<
  NotificationType,
  NotificationCategory
> = {
  MENTORSHIP_ASSIGNED: 'mentees',
  MENTORSHIP_ENDED: 'mentees',
  INTERACTION_SCHEDULED: 'journey',
  INTERACTION_CHANGED: 'journey',
  CONTACT_DUE: 'mentees',
  CONTACT_LATE: 'mentees',
  GATHERING_RSVP_REQUEST: 'groups',
  GATHERING_REMINDER: 'groups',
  TRACKABLE_CREATED: 'journey',
  TRACKABLE_CHANGED: 'journey',
  CYCLE_WAITING: 'journey',
  ENTRY_LOGGED: 'mentees',
  CHALLENGE_RAISED: 'journey',
  CHALLENGE_COMMENTED: 'journey',
  CHALLENGE_RESOLVED: 'journey',
  MENTOR_REPLIED: 'journey',
  TASK_ASSIGNED: 'journey',
  NEW_MESSAGE: 'other',
};

/** Always delivered in-app; email stays the user's choice. */
export const MANDATORY_NOTIFICATIONS: readonly NotificationType[] = [
  'MENTORSHIP_ASSIGNED',
  'MENTORSHIP_ENDED',
  'GATHERING_RSVP_REQUEST',
];

export function isNotificationType(value: unknown): value is NotificationType {
  return NOTIFICATION_TYPES.includes(value as NotificationType);
}
