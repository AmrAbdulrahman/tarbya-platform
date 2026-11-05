import type { GatheringSummaryDto, GatheringTypeDto } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { ORG_TIMEZONE } from '@tarbya/shared';

/** A lookup's name in the active language. */
export const typeName = (
  type: Pick<GatheringTypeDto, 'nameAr' | 'nameEn'>,
  locale: Language,
) => (locale === 'ar' ? type.nameAr : type.nameEn);

/** A gathering is named by its title, else by its type. */
export const gatheringTitle = (g: GatheringSummaryDto, locale: Language) =>
  g.title || typeName(g.activityType, locale);

/** 0 Sunday … 6 Saturday, as a day name. */
export function weekdayName(weekday: number, locale: Language): string {
  // 2026-11-01 is a Sunday.
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2026, 10, 1 + weekday)));
}

/** The day name of an instant in the organisation zone. */
export function dayOf(at: string, locale: Language): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'long',
    timeZone: ORG_TIMEZONE,
  }).format(new Date(at));
}

export const isPast = (g: Pick<GatheringSummaryDto, 'startsAt'>) =>
  new Date(g.startsAt).getTime() <= Date.now();

export const groupQueryKey = (id: string) => ['groups', id];
export const gatheringQueryKey = (id: string) => ['gathering', id];
