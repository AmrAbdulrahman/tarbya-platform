import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrackableType, TrackingCycle } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatMonth, logDay } from '@tarbya/shared';
import { cn } from '@tarbya/ui';
import { useMe } from '../../auth/session';

export function formatNumber(n: number, lang: string) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    maximumFractionDigits: 2,
  }).format(n);
}

/** Done or not done: a green check or a red cross, named for screen readers. */
export function DoneMark({
  done,
  className = 'size-5',
}: {
  done: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const label = done ? t('trackables.done') : t('trackables.notDone');
  return done ? (
    <Check
      role="img"
      aria-label={label}
      strokeWidth={3}
      className={`inline-block shrink-0 text-trend-up ${className}`}
    />
  ) : (
    <X
      role="img"
      aria-label={label}
      strokeWidth={3}
      className={`inline-block shrink-0 text-trend-down ${className}`}
    />
  );
}

/** A logged value as its type reads: a count, a percentage, or done / not done. */
export function useFormatValue() {
  const { i18n } = useTranslation();
  return (value: number, type: TrackableType): ReactNode =>
    type === 'BOOLEAN' ? (
      <DoneMark done={value >= 1} className="size-[1em]" />
    ) : type === 'PERCENTAGE' ? (
      `${formatNumber(value, i18n.language)}%`
    ) : (
      formatNumber(value, i18n.language)
    );
}

/** The same as words, for places that need text (sentences, labels). */
export function useValueText() {
  const { t, i18n } = useTranslation();
  return (value: number, type: TrackableType): string =>
    type === 'BOOLEAN'
      ? value >= 1
        ? t('trackables.done')
        : t('trackables.notDone')
      : type === 'PERCENTAGE'
        ? `${formatNumber(value, i18n.language)}%`
        : formatNumber(value, i18n.language);
}

/**
 * Done / not done as two icon buttons, a check and a cross. A second click
 * on the chosen one clears it when `clearable`.
 */
export function DoneToggle({
  value,
  onChange,
  label,
  clearable = false,
  disabled,
}: {
  value: '' | '0' | '1';
  onChange: (value: '' | '0' | '1') => void;
  label: string;
  clearable?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {(['1', '0'] as const).map((v) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={
              v === '1' ? t('trackables.done') : t('trackables.notDone')
            }
            title={v === '1' ? t('trackables.done') : t('trackables.notDone')}
            onClick={() => onChange(on && clearable ? '' : v)}
            className={cn(
              'grid size-9 place-items-center rounded-control border transition-colors disabled:opacity-50',
              v === '1'
                ? on
                  ? 'border-trend-up bg-trend-up text-white'
                  : 'border-border bg-card text-trend-up hover:border-trend-up hover:bg-emerald-50'
                : on
                  ? 'border-trend-down bg-trend-down text-white'
                  : 'border-border bg-card text-trend-down hover:border-trend-down hover:bg-red-50',
            )}
          >
            {v === '1' ? (
              <Check className="size-5" strokeWidth={3} aria-hidden />
            ) : (
              <X className="size-5" strokeWidth={3} aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Names a cycle by its first day: the day, "week of …", or the month. */
export function useCycleLabel() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const locale = i18n.language as Language;
  /** A weekly cycle with a chosen weekday is named by that day (BR-TRK-1). */
  return (start: string, cycle: TrackingCycle, weekday?: number | null) => {
    // Noon UTC is the same calendar day in the organisation zone.
    const at = `${logDay(start, cycle, weekday)}T12:00:00Z`;
    if (cycle === 'MONTHLY') return formatMonth(at, { locale });
    const date = formatDate(at, { locale, calendar: me.calendar });
    return cycle === 'WEEKLY' && (weekday === null || weekday === undefined)
      ? t('trackables.weekOf', { date })
      : date;
  };
}
