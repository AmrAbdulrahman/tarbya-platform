import { useTranslation } from 'react-i18next';
import type { TrackableType, TrackingCycle } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatMonth } from '@tarbya/shared';
import { useMe } from '../../auth/session';

export function formatNumber(n: number, lang: string) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    maximumFractionDigits: 2,
  }).format(n);
}

/** A logged value as its type reads: a count, a percentage, or done / not done. */
export function useFormatValue() {
  const { t, i18n } = useTranslation();
  return (value: number, type: TrackableType) =>
    type === 'BOOLEAN'
      ? value >= 1
        ? t('trackables.done')
        : t('trackables.notDone')
      : type === 'PERCENTAGE'
        ? `${formatNumber(value, i18n.language)}%`
        : formatNumber(value, i18n.language);
}

/** Names a cycle by its first day: the day, "week of …", or the month. */
export function useCycleLabel() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const locale = i18n.language as Language;
  return (start: string, cycle: TrackingCycle) => {
    // Noon UTC is the same calendar day in the organisation zone.
    const at = `${start}T12:00:00Z`;
    if (cycle === 'MONTHLY') return formatMonth(at, { locale });
    const date = formatDate(at, { locale, calendar: me.calendar });
    return cycle === 'WEEKLY' ? t('trackables.weekOf', { date }) : date;
  };
}
