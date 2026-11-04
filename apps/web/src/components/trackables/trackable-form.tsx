import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { toZoned } from '@tarbya/shared';
import { Button, Checkbox, Input, Select } from '@tarbya/ui';
import { Field, FormError } from '../login/fields';

const TYPES = ['COUNT', 'BOOLEAN', 'PERCENTAGE'] as const;
const CYCLES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
// The organisation's week runs Saturday to Friday; the number is 0 for Sunday.
const WEEKDAYS = [
  [6, 'sat'],
  [0, 'sun'],
  [1, 'mon'],
  [2, 'tue'],
  [3, 'wed'],
  [4, 'thu'],
  [5, 'fri'],
] as const;

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120),
  goal: z.string().trim().max(300),
  type: z.enum(TYPES),
  cycle: z.enum(CYCLES),
  higherIsBetter: z.enum(['yes', 'no']),
  // Empty means no target.
  target: z
    .string()
    .refine((v) => v.trim() === '' || Number(v) >= 0, 'validation.number'),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
  isPublic: z.boolean(),
  // Weekly only; empty shows the log on the week's first day.
  weekday: z.string(),
});
export type TrackableValues = z.infer<typeof schema>;

/** What the API takes for the fields every trackable and template share. */
export function sharedFields(v: TrackableValues) {
  return {
    name: v.name,
    goal: v.goal || null,
    higherIsBetter: v.higherIsBetter === 'yes',
    target:
      v.type === 'BOOLEAN' || v.target.trim() === '' ? null : Number(v.target),
  };
}

/** The weekday a weekly trackable's log shows on, or null (BR-TRK-1). */
export function weekdayField(v: TrackableValues): number | null {
  return v.cycle === 'WEEKLY' && v.weekday !== '' ? Number(v.weekday) : null;
}

export interface TrackableFormProps {
  initial?: Partial<{
    name: string;
    goal: string | null;
    type: TrackableValues['type'];
    cycle: TrackableValues['cycle'];
    higherIsBetter: boolean;
    target: number | null;
    startsOn: string;
    isPublic: boolean;
    weekday: number | null;
  }>;
  /** Type and cycle are fixed (something is logged). */
  lockShape?: boolean;
  /** Name, goal, type, cycle and direction come from a template. */
  lockShared?: boolean;
  /** Shown when the start date can still change. */
  showStart?: boolean;
  /** Editing a template: the "share with all mentors" switch. */
  showPublic?: boolean;
  /** Under the fields, above the buttons. */
  notice?: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  pending: boolean;
  error?: string;
  onSubmit: (values: TrackableValues) => void;
  onCancel: () => void;
}

/** The fields of a trackable or a library template (BR-TRK-1, BR-TRK-7). */
export function TrackableForm({
  initial,
  lockShape,
  lockShared,
  showStart,
  showPublic,
  notice,
  submitLabel,
  cancelLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: TrackableFormProps) {
  const { t } = useTranslation();
  const form = useForm<TrackableValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      goal: initial?.goal ?? '',
      type: initial?.type ?? 'COUNT',
      cycle: initial?.cycle ?? 'WEEKLY',
      higherIsBetter: initial?.higherIsBetter === false ? 'no' : 'yes',
      target:
        initial?.target === null || initial?.target === undefined
          ? ''
          : String(initial.target),
      startsOn: initial?.startsOn ?? toZoned(new Date()).date,
      isPublic: initial?.isPublic ?? false,
      weekday:
        initial?.weekday === null || initial?.weekday === undefined
          ? ''
          : String(initial.weekday),
    },
  });
  const { errors } = form.formState;
  const type = form.watch('type');
  const cycle = form.watch('cycle');
  const err = (name: keyof TrackableValues) =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.required')
      : undefined;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      <Field id="trk-name" label={t('trackables.name')} error={err('name')}>
        <Input
          id="trk-name"
          className="h-11 text-[15px]"
          disabled={lockShared}
          aria-invalid={!!errors.name}
          {...form.register('name')}
        />
      </Field>
      <Field id="trk-goal" label={t('trackables.goal')}>
        <Input
          id="trk-goal"
          className="h-11 text-[15px]"
          disabled={lockShared}
          {...form.register('goal')}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="trk-type" label={t('trackables.type')}>
          <Select
            id="trk-type"
            disabled={lockShape || lockShared}
            {...form.register('type')}
          >
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`trackables.types.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="trk-cycle" label={t('trackables.cycle')}>
          <Select
            id="trk-cycle"
            disabled={lockShape || lockShared}
            {...form.register('cycle')}
          >
            {CYCLES.map((x) => (
              <option key={x} value={x}>
                {t(`trackables.cycles.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="trk-direction" label={t('trackables.direction')}>
          <Select
            id="trk-direction"
            disabled={lockShared}
            {...form.register('higherIsBetter')}
          >
            <option value="yes">{t('trackables.higherBetter')}</option>
            <option value="no">{t('trackables.lowerBetter')}</option>
          </Select>
        </Field>
        {type !== 'BOOLEAN' && (
          <Field
            id="trk-target"
            label={t('trackables.target')}
            error={err('target')}
          >
            <Input
              id="trk-target"
              type="number"
              min={0}
              max={type === 'PERCENTAGE' ? 100 : undefined}
              step="any"
              dir="ltr"
              className="h-11 font-figures text-[15px]"
              aria-invalid={!!errors.target}
              {...form.register('target')}
            />
          </Field>
        )}
        {/* Where the log shows, not when the week runs; templates leave it to each mentee. */}
        {cycle === 'WEEKLY' && !showPublic && (
          <Field id="trk-weekday" label={t('trackables.weekday')}>
            <Select id="trk-weekday" {...form.register('weekday')}>
              <option value="">{t('trackables.wholeWeek')}</option>
              {WEEKDAYS.map(([d, name]) => (
                <option key={d} value={String(d)}>
                  {t(`trackables.weekdays.${name}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {showStart && (
          <Field
            id="trk-starts"
            label={t('trackables.startsOn')}
            error={err('startsOn')}
          >
            <Input
              id="trk-starts"
              type="date"
              max={toZoned(new Date()).date}
              className="h-11 text-[15px]"
              {...form.register('startsOn')}
            />
          </Field>
        )}
      </div>
      {showPublic && (
        <Checkbox
          id="trk-public"
          label={t('trackables.library.shareLabel')}
          hint={t('trackables.library.shareHint')}
          {...form.register('isPublic')}
        />
      )}
      {notice}
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {submitLabel ?? t('admin.common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel ?? t('admin.common.cancel')}
        </Button>
      </div>
    </form>
  );
}
