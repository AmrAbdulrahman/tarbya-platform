import type { Role } from './roles.js';

/** System settings (BR-ORG-5, BR-AUTH-2) and the value each starts with. */
export interface Settings {
  'auth.signInRoles': Role[];
  'contact.dueDays': number;
  'contact.lateDays': number;
  'gatherings.rsvpRequestHours': number;
  'gatherings.reminderHours': number;
  'trackables.trendWindow': number;
  'trackables.trendSteadyBand': number;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  'auth.signInRoles': ['MODERATOR', 'MENTOR'],
  'contact.dueDays': 7,
  'contact.lateDays': 14,
  'gatherings.rsvpRequestHours': 48,
  'gatherings.reminderHours': 3,
  'trackables.trendWindow': 3,
  'trackables.trendSteadyBand': 0.05,
};
