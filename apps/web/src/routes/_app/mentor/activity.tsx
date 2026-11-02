import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  interactionsControllerCreateActivity,
  lookupsControllerActivityTypes,
  mentorshipsControllerMine,
  type ActivityTypeDto,
  type MyMentoringDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { fromZoned, toZoned } from '@tarbya/shared';
import { Button, Checkbox, cn, Input, Textarea } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { lookupColors } from '../../../components/admin/lookup-colors';
import { Field, FormError } from '../../../components/login/fields';
import { EntryKind, WhenStatus } from '../../../components/mentor/entry-kind';
import {
  Card,
  Hint,
  mineQueryKey,
} from '../../../components/mentor/form-parts';
import { ParticipantsPicker } from '../../../components/mentor/participants-picker';

/** US-4.4 · design/screens/Activity.dc.html */
export const Route = createFileRoute('/_app/mentor/activity')({
  component: ActivityPage,
});

const day = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    activityTypeId: z.string().min(1, 'validation.required'),
    title: z.string().trim().min(1, 'validation.required').max(200),
    participants: z.array(z.custom<UserRefDto>()).min(1, 'validation.required'),
    date: z.string().regex(day, 'validation.date'),
    multiDay: z.boolean(),
    returnDate: z.string(),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'validation.required'),
    place: z.string().max(200),
    sharedNotes: z.string().max(5000),
    privateNotes: z.string().max(5000),
  })
  .refine(
    (v) => !v.multiDay || (day.test(v.returnDate) && v.returnDate >= v.date),
    {
      path: ['returnDate'],
      message: 'validation.date',
    },
  );
type Values = z.infer<typeof schema>;

function blank(): Values {
  const now = toZoned(new Date());
  return {
    activityTypeId: '',
    title: '',
    participants: [],
    date: now.date,
    multiDay: false,
    returnDate: '',
    time: now.time,
    place: '',
    sharedNotes: '',
    privateNotes: '',
  };
}

function ActivityPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const types = useQuery({
    queryKey: ['activity-types'],
    queryFn: async ({ signal }) =>
      (await lookupsControllerActivityTypes({ signal }))
        .data as ActivityTypeDto[],
  });
  const mine = useQuery({
    queryKey: mineQueryKey,
    queryFn: async ({ signal }) =>
      (await mentorshipsControllerMine({ signal })).data as MyMentoringDto,
  });
  const choices = (types.data ?? []).filter(
    (x) => x.active && x.scope === 'INDIVIDUAL',
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: blank(),
  });
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (v: Values) =>
      interactionsControllerCreateActivity({
        activityTypeId: v.activityTypeId,
        title: v.title,
        participantIds: v.participants.map((p) => p.id),
        startsAt: fromZoned({ date: v.date, time: v.time }).toISOString(),
        // A trip ends on its return day, at the same time of day it started.
        endsAt: v.multiDay
          ? fromZoned({ date: v.returnDate, time: v.time }).toISOString()
          : null,
        place: v.place || null,
        sharedNotes: v.sharedNotes || null,
        privateNotes: v.privateNotes || null,
      }),
    onSuccess: async () => {
      form.reset(blank());
      await queryClient.invalidateQueries({ queryKey: mineQueryKey });
    },
  });

  const [date, time, multiDay] = form.watch(['date', 'time', 'multiDay']);
  const upcoming =
    day.test(date) && /^\d{2}:\d{2}$/.test(time)
      ? fromZoned({ date, time }) > new Date()
      : false;
  const err = (name: keyof Values) =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.required')
      : undefined;
  const name = (x: ActivityTypeDto) =>
    i18n.language === 'ar' ? x.nameAr : x.nameEn;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      className="flex max-w-4xl flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-navy">
          {t('mentoring.log.activityTitle')}
        </h1>
        <p className="text-[15px] text-ink-subtle">
          {t('mentoring.log.activityLead')}
        </p>
      </div>
      <EntryKind current="activity" />

      <Card>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-ink-muted">
            {t('mentoring.log.activityType')}
          </legend>
          <Controller
            control={form.control}
            name="activityTypeId"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label={t('mentoring.log.activityType')}
                className="flex flex-wrap gap-2"
              >
                {choices.map((x) => {
                  const on = field.value === x.id;
                  const c = lookupColors[x.color];
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => field.onChange(x.id)}
                      className={cn(
                        'flex h-11 items-center gap-2 rounded-full border-2 pe-4 ps-1.5 text-[15px] font-medium',
                        on
                          ? 'border-primary bg-primary-tint/60'
                          : 'border-border bg-card hover:border-primary/50',
                      )}
                    >
                      <span
                        aria-hidden
                        style={{ backgroundColor: c.tint, color: c.text }}
                        className="grid size-8 place-items-center rounded-full font-bold"
                      >
                        {name(x).charAt(0)}
                      </span>
                      {name(x)}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {err('activityTypeId') && (
            <p className="text-sm text-trend-down">{err('activityTypeId')}</p>
          )}
          <span className="text-[13px] text-ink-subtle">
            {t('mentoring.log.typesHint')}
          </span>
        </fieldset>
        <Field
          id="ac-title"
          label={t('mentoring.log.activityName')}
          error={err('title')}
        >
          <Input
            id="ac-title"
            className="h-11 text-[15px]"
            aria-invalid={!!errors.title}
            {...form.register('title')}
          />
        </Field>
        <Field
          id="ac-who"
          label={
            <>
              {t('mentoring.log.participants')}{' '}
              <Hint>{t('mentoring.log.participantsHint')}</Hint>
            </>
          }
          error={err('participants')}
        >
          <Controller
            control={form.control}
            name="participants"
            render={({ field }) => (
              <ParticipantsPicker
                id="ac-who"
                value={field.value}
                onChange={field.onChange}
                suggestions={mine.data?.mentees.map((m) => m.mentee) ?? []}
                invalid={!!errors.participants}
              />
            )}
          />
        </Field>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id="ac-date"
            label={
              multiDay ? t('mentoring.log.startDate') : t('mentoring.log.date')
            }
            error={err('date')}
          >
            <Input
              id="ac-date"
              type="date"
              className="h-11 text-[15px]"
              {...form.register('date')}
            />
          </Field>
          {multiDay && (
            <Field
              id="ac-return"
              label={t('mentoring.log.returnDate')}
              error={err('returnDate')}
            >
              <Input
                id="ac-return"
                type="date"
                className="h-11 text-[15px]"
                aria-invalid={!!errors.returnDate}
                {...form.register('returnDate')}
              />
            </Field>
          )}
          <Field
            id="ac-time"
            label={t('mentoring.log.time')}
            error={err('time')}
          >
            <Input
              id="ac-time"
              type="time"
              className="h-11 text-[15px]"
              {...form.register('time')}
            />
          </Field>
          <Field id="ac-place" label={t('mentoring.log.place')}>
            <Input
              id="ac-place"
              className="h-11 text-[15px]"
              {...form.register('place')}
            />
          </Field>
        </div>
        <Checkbox
          id="ac-multi"
          label={t('mentoring.log.multiDay')}
          {...form.register('multiDay')}
        />
        <WhenStatus upcoming={upcoming} />
      </Card>

      <Card title={t('mentoring.log.notes')}>
        <Field
          id="ac-shared"
          label={
            <>
              {t('mentoring.log.description')}{' '}
              <Hint>{t('mentoring.log.descriptionHint')}</Hint>
            </>
          }
        >
          <Textarea id="ac-shared" rows={2} {...form.register('sharedNotes')} />
        </Field>
        <Field
          id="ac-private"
          label={
            <>
              {t('mentoring.log.privateNote')}{' '}
              <Hint>{t('mentoring.log.privateHint')}</Hint>
            </>
          }
        >
          <Textarea
            id="ac-private"
            rows={2}
            {...form.register('privateNotes')}
          />
        </Field>
      </Card>

      <FormError
        message={save.isError ? errorMessage(t, save.error) : undefined}
      />
      {save.isSuccess && !form.formState.isDirty && (
        <p role="status" className="text-sm font-medium text-trend-up">
          {t('mentoring.log.saved')}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('mentoring.log.save')}
        </Button>
      </div>
    </form>
  );
}
