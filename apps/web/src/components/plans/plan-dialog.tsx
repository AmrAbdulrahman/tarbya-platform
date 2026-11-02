import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  lookupsControllerTrackingMethods,
  plansControllerCreate,
  plansControllerUpdate,
  type PlanDetailDto,
  type TrackingMethodDto,
} from '@tarbya/api-client';
import { Button, Dialog, DialogContent, Input, Select } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from '../login/fields';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120),
  goal: z.string().trim().min(1, 'validation.required').max(300),
  trackingMethodId: z.string().min(1, 'validation.required'),
  target: z.number({ error: 'validation.number' }),
  higherIsBetter: z.enum(['yes', 'no']),
  endsOn: z.string(),
});
type Values = z.infer<typeof schema>;

interface Props {
  menteeId: string;
  /** Absent to create. */
  plan?: PlanDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** US-4.5 (the design has the entry point; the form itself follows the other dialogs). */
export function PlanDialog({ menteeId, plan, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={plan ? t('plans.editTitle') : t('plans.newTitle')}
        closeLabel={t('admin.common.close')}
      >
        <PlanForm
          key={plan?.id ?? 'new'}
          menteeId={menteeId}
          plan={plan}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({
  menteeId,
  plan,
  onDone,
}: {
  menteeId: string;
  plan?: PlanDetailDto;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const methods = useQuery({
    queryKey: ['tracking-methods'],
    queryFn: async ({ signal }) =>
      (await lookupsControllerTrackingMethods({ signal }))
        .data as TrackingMethodDto[],
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: plan?.name ?? '',
      goal: plan?.goal ?? '',
      trackingMethodId: plan?.trackingMethod.id ?? '',
      target: plan?.target,
      higherIsBetter: plan?.higherIsBetter === false ? 'no' : 'yes',
      endsOn: plan?.endsOn ?? '',
    },
  });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        name: v.name,
        goal: v.goal,
        trackingMethodId: v.trackingMethodId,
        target: v.target,
        higherIsBetter: v.higherIsBetter === 'yes',
        endsOn: v.endsOn || null,
      };
      return plan
        ? plansControllerUpdate(plan.id, body)
        : plansControllerCreate({ ...body, menteeId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      onDone();
    },
  });
  const err = (name: keyof Values) =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.required')
      : undefined;
  const active = (methods.data ?? []).filter(
    (m) => m.active || m.id === plan?.trackingMethod.id,
  );

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      className="flex flex-col gap-4"
    >
      <Field id="plan-name" label={t('plans.name')} error={err('name')}>
        <Input
          id="plan-name"
          className="h-11 text-[15px]"
          aria-invalid={!!errors.name}
          {...form.register('name')}
        />
      </Field>
      <Field id="plan-goal" label={t('plans.goal')} error={err('goal')}>
        <Input
          id="plan-goal"
          className="h-11 text-[15px]"
          aria-invalid={!!errors.goal}
          {...form.register('goal')}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="plan-tracking"
          label={t('plans.tracking')}
          error={err('trackingMethodId')}
        >
          <Select
            id="plan-tracking"
            aria-invalid={!!errors.trackingMethodId}
            {...form.register('trackingMethodId')}
          >
            <option value="" />
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {i18n.language === 'ar' ? m.nameAr : m.nameEn}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="plan-target" label={t('plans.target')} error={err('target')}>
          <Input
            id="plan-target"
            type="number"
            step="any"
            dir="ltr"
            className="h-11 font-figures text-[15px]"
            aria-invalid={!!errors.target}
            {...form.register('target', { valueAsNumber: true })}
          />
        </Field>
        <Field id="plan-direction" label={t('plans.direction')}>
          <Select id="plan-direction" {...form.register('higherIsBetter')}>
            <option value="yes">{t('plans.higherBetter')}</option>
            <option value="no">{t('plans.lowerBetter')}</option>
          </Select>
        </Field>
        <Field id="plan-ends" label={t('plans.endsOn')}>
          <Input
            id="plan-ends"
            type="date"
            className="h-11 text-[15px]"
            {...form.register('endsOn')}
          />
        </Field>
      </div>
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
