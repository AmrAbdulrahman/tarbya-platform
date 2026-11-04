import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrackableType, TrackingCycle } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatMonth, logDay } from '@tarbya/shared';
import { cn, Input } from '@tarbya/ui';
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

/** Counts whose scale is below this get a button for each number. */
const COUNT_BUTTONS_BELOW = 20;

/**
 * A cycle's value in the way that suits the type: done / not done, a slider
 * for a percentage, a button per number for a small count, or a number.
 * `value` is the text of the number; empty means nothing logged.
 */
export function ValueInput({
  trackable: tr,
  value,
  onChange,
  label,
  clearable = false,
  autoFocus,
}: {
  trackable: { type: TrackableType; target: number | null; points: number[] };
  value: string;
  onChange: (value: string) => void;
  label: string;
  clearable?: boolean;
  autoFocus?: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (tr.type === 'BOOLEAN') {
    return (
      <DoneToggle
        label={label}
        clearable={clearable}
        value={value === '1' || value === '0' ? value : ''}
        onChange={onChange}
      />
    );
  }
  const exact = (className: string, max?: number) => (
    <Input
      type="number"
      min={0}
      max={max}
      step="any"
      dir="ltr"
      autoFocus={autoFocus}
      aria-label={label}
      className={cn('h-9 text-center font-figures text-[15px]', className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (tr.type === 'PERCENTAGE') {
    return (
      <div className="flex min-w-48 flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label={`${label} · %`}
          className="h-9 min-w-24 flex-1 cursor-pointer accent-primary"
          value={value === '' ? 0 : Number(value)}
          onChange={(e) => onChange(e.target.value)}
        />
        {exact('w-16', 100)}
      </div>
    );
  }
  // The scale is the target, or the highest value so far without one.
  const scale = Math.max(tr.target ?? 0, ...tr.points, Number(value) || 0);
  if (scale <= 0 || scale >= COUNT_BUTTONS_BELOW) return exact('w-24');
  const picked = value === '' ? null : Number(value);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <div role="group" aria-label={label} className="contents">
        {Array.from({ length: Math.floor(scale) + 1 }, (_, n) => (
          <button
            key={n}
            type="button"
            aria-pressed={picked === n}
            onClick={() => onChange(picked === n && clearable ? '' : String(n))}
            className={cn(
              'grid h-8 min-w-8 place-items-center rounded-control border px-1.5 font-figures text-[14px] transition-colors',
              picked === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-ink hover:border-primary hover:bg-primary-tint',
            )}
          >
            {formatNumber(n, i18n.language)}
          </button>
        ))}
      </div>
      <Input
        type="number"
        min={0}
        step="any"
        dir="ltr"
        aria-label={`${label} · ${t('trackables.exact')}`}
        placeholder="…"
        className="h-8 w-14 px-1 text-center font-figures text-[14px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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
