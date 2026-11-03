import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  trackablesControllerCreate,
  trackablesControllerUpdate,
  type TrackableDetailDto,
} from '@tarbya/api-client';
import { toZoned } from '@tarbya/shared';
import { Button, Dialog, DialogContent, Input, Select } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from '../login/fields';

const TYPES = ['COUNT', 'BOOLEAN', 'PERCENTAGE'] as const;
const CYCLES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

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
});
type Values = z.infer<typeof schema>;

interface Props {
  menteeId: string;
  /** Absent to create. */
  trackable?: TrackableDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** US-4.5: create or edit a trackable (BR-TRK-1). */
export function TrackableDialog({
  menteeId,
  trackable,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={trackable ? t('trackables.editTitle') : t('trackables.newTitle')}
        closeLabel={t('admin.common.close')}
      >
        <TrackableForm
          key={trackable?.id ?? 'new'}
          menteeId={menteeId}
          trackable={trackable}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TrackableForm({
  menteeId,
  trackable,
  onDone,
}: {
  menteeId: string;
  trackable?: TrackableDetailDto;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: trackable?.name ?? '',
      goal: trackable?.goal ?? '',
      type: trackable?.type ?? 'COUNT',
      cycle: trackable?.cycle ?? 'WEEKLY',
      higherIsBetter: trackable?.higherIsBetter === false ? 'no' : 'yes',
      target:
        trackable?.target === null || !trackable
          ? ''
          : String(trackable.target),
      startsOn: trackable?.startsOn ?? toZoned(new Date()).date,
    },
  });
  const { errors } = form.formState;
  const type = form.watch('type');
  // Type, cycle and start are fixed once something is logged (BR-TRK-1).
  const reshapable = !trackable || trackable.logged === 0;
  const save = useMutation({
    mutationFn: (v: Values) => {
      const shared = {
        name: v.name,
        goal: v.goal || null,
        higherIsBetter: v.higherIsBetter === 'yes',
        target:
          v.type === 'BOOLEAN' || v.target.trim() === ''
            ? null
            : Number(v.target),
      };
      return trackable
        ? trackablesControllerUpdate(trackable.id, {
            ...shared,
            ...(reshapable && {
              type: v.type,
              cycle: v.cycle,
              startsOn: v.startsOn,
            }),
          })
        : trackablesControllerCreate({
            ...shared,
            menteeId,
            type: v.type,
            cycle: v.cycle,
            startsOn: v.startsOn,
          });
    },
    onSuccess: async () => {
      await Promise.all(
        [['trackables'], ['dashboard']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      onDone();
    },
  });
  const err = (name: keyof Values) =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.required')
      : undefined;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      className="flex flex-col gap-4"
    >
      <Field id="trk-name" label={t('trackables.name')} error={err('name')}>
        <Input
          id="trk-name"
          className="h-11 text-[15px]"
          aria-invalid={!!errors.name}
          {...form.register('name')}
        />
      </Field>
      <Field id="trk-goal" label={t('trackables.goal')}>
        <Input
          id="trk-goal"
          className="h-11 text-[15px]"
          {...form.register('goal')}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="trk-type" label={t('trackables.type')}>
          <Select
            id="trk-type"
            disabled={!reshapable}
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
            disabled={!reshapable}
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
          <Select id="trk-direction" {...form.register('higherIsBetter')}>
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
        {reshapable && (
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
      {!reshapable && (
        <p className="text-[13px] text-ink-subtle">
          {t('trackables.fixedHint')}
        </p>
      )}
      <FormError
        message={save.isError ? errorMessage(t, save.error) : undefined}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('admin.common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('admin.common.cancel')}
        </Button>
      </div>
    </form>
  );
}
