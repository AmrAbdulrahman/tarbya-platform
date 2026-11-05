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

export interface Delivery {
  inApp: boolean;
  email: boolean;
}

/**
 * What each type does until the user chooses (US-2.4). Messages have their own
 * badge, so they come by email only; frequent updates stay in-app.
 */
export const NOTIFICATION_DEFAULTS: Record<NotificationType, Delivery> = {
  MENTORSHIP_ASSIGNED: { inApp: true, email: true },
  MENTORSHIP_ENDED: { inApp: true, email: true },
  INTERACTION_SCHEDULED: { inApp: true, email: true },
  INTERACTION_CHANGED: { inApp: true, email: true },
  CONTACT_DUE: { inApp: true, email: false },
  CONTACT_LATE: { inApp: true, email: true },
  GATHERING_RSVP_REQUEST: { inApp: true, email: true },
  GATHERING_REMINDER: { inApp: true, email: true },
  TRACKABLE_CREATED: { inApp: true, email: false },
  TRACKABLE_CHANGED: { inApp: true, email: false },
  CYCLE_WAITING: { inApp: true, email: true },
  ENTRY_LOGGED: { inApp: true, email: false },
  CHALLENGE_RAISED: { inApp: true, email: true },
  CHALLENGE_COMMENTED: { inApp: true, email: false },
  CHALLENGE_RESOLVED: { inApp: true, email: false },
  MENTOR_REPLIED: { inApp: true, email: true },
  TASK_ASSIGNED: { inApp: true, email: true },
  NEW_MESSAGE: { inApp: false, email: true },
};

/** The user's choice over the default; mandatory types always arrive in-app. */
export function deliveryFor(
  type: NotificationType,
  choice?: Partial<Delivery> | null,
): Delivery {
  const fallback = NOTIFICATION_DEFAULTS[type];
  return {
    inApp:
      MANDATORY_NOTIFICATIONS.includes(type) ||
      (choice?.inApp ?? fallback.inApp),
    email: choice?.email ?? fallback.email,
  };
}

type Payload = Record<string, unknown>;
const str = (p: Payload, key: string) =>
  typeof p[key] === 'string' ? (p[key] as string) : '';

/** Where a notification leads, in the app and from its email. */
export function notificationLink(
  type: NotificationType,
  payload: Payload,
  recipientId: string,
): string {
  const mentee = str(payload, 'menteeId');
  const menteePage =
    mentee && mentee !== recipientId ? `/people/${mentee}` : '/my';
  switch (type) {
    case 'MENTORSHIP_ASSIGNED':
    case 'MENTORSHIP_ENDED':
    case 'CONTACT_DUE':
    case 'CONTACT_LATE':
    case 'CHALLENGE_RAISED':
    case 'CHALLENGE_COMMENTED':
    case 'CHALLENGE_RESOLVED':
      return menteePage;
    case 'GATHERING_RSVP_REQUEST':
    case 'GATHERING_REMINDER':
      return `/groups/${str(payload, 'groupId')}?gathering=${str(payload, 'gatheringId')}`;
    case 'TRACKABLE_CREATED':
    case 'TRACKABLE_CHANGED':
    case 'ENTRY_LOGGED':
    case 'MENTOR_REPLIED':
      return `/trackables/${str(payload, 'trackableId')}`;
    case 'NEW_MESSAGE':
      return `/messages?c=${str(payload, 'conversationId')}`;
    case 'INTERACTION_SCHEDULED':
    case 'INTERACTION_CHANGED':
    case 'CYCLE_WAITING':
    case 'TASK_ASSIGNED':
      return '/my';
  }
}
