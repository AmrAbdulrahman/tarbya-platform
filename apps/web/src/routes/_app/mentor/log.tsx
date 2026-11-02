import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  interactionsControllerCreateFollowUp,
  mentorshipsControllerMine,
  type MyMentoringDto,
} from '@tarbya/api-client';
import { fromZoned, toZoned } from '@tarbya/shared';
import { Button, Input, Select, Textarea } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { Field, FormError } from '../../../components/login/fields';
import { EntryKind, WhenStatus } from '../../../components/mentor/entry-kind';
import {
  Card,
  Hint,
  mineQueryKey,
} from '../../../components/mentor/form-parts';
import { MenteeContext } from '../../../components/mentor/mentee-context';
import { PlanUpdates } from '../../../components/mentor/plan-updates';

/** US-4.3 · design/screens/FollowUp.dc.html */
export const Route = createFileRoute('/_app/mentor/log')({
  // Opened from the dashboard or a mentee's profile with the mentee chosen.
  validateSearch: z.object({
    menteeId: z.string().uuid().optional().catch(undefined),
  }),
  component: FollowUpPage,
});

const schema = z.object({
  menteeId: z.string().min(1, 'validation.required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'validation.required'),
  place: z.string().max(200),
  sharedNotes: z.string().max(5000),
  privateNotes: z.string().max(5000),
  challenges: z.array(z.object({ text: z.string().max(300) })),
  tasks: z.array(z.object({ title: z.string().max(200), dueOn: z.string() })),
});
type Values = z.infer<typeof schema>;

function blank(menteeId = ''): Values {
  const now = toZoned(new Date());
  return {
    menteeId,
    date: now.date,
    time: now.time,
    place: '',
    sharedNotes: '',
    privateNotes: '',
    challenges: [],
    tasks: [],
  };
}

function FollowUpPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mine = useQuery({
    queryKey: mineQueryKey,
    queryFn: async ({ signal }) =>
      (await mentorshipsControllerMine({ signal })).data as MyMentoringDto,
  });
  const { menteeId: preset } = Route.useSearch();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: blank(preset),
  });
  const [planValues, setPlanValues] = useState<Record<string, string>>({});
  const challenges = useFieldArray({
    control: form.control,
    name: 'challenges',
  });
  const tasks = useFieldArray({ control: form.control, name: 'tasks' });
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (v: Values) =>
      interactionsControllerCreateFollowUp({
        menteeId: v.menteeId,
        startsAt: fromZoned({ date: v.date, time: v.time }).toISOString(),
        place: v.place || null,
        sharedNotes: v.sharedNotes || null,
        privateNotes: v.privateNotes || null,
        challenges: v.challenges.map((c) => c.text).filter((c) => c.trim()),
        tasks: v.tasks
          .filter((task) => task.title.trim())
          .map((task) => ({ title: task.title, dueOn: task.dueOn || null })),
        planUpdates: Object.entries(planValues)
          .filter(
            ([, value]) =>
              value.trim() !== '' && Number.isFinite(Number(value)),
          )
          .map(([planId, value]) => ({ planId, value: Number(value) })),
      }),
    onSuccess: async (_res, v) => {
      form.reset(blank(v.menteeId));
      setPlanValues({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mineQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['plans'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ]);
    },
  });

  const [menteeId, date, time] = form.watch(['menteeId', 'date', 'time']);
  const selected = mine.data?.mentees.find((m) => m.mentee.id === menteeId);
  const upcoming =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
      ? fromZoned({ date, time }) > new Date()
      : false;
  const err = (name: 'menteeId' | 'date' | 'time') =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.required')
      : undefined;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <form
        noValidate
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
        className="flex min-w-0 flex-[2_1_560px] flex-col gap-6"
      >
        <h1 className="text-3xl font-bold text-navy">
          {t('mentoring.log.followUpTitle')}
        </h1>
        <EntryKind current="follow-up" />

        <Card>
          <Field
            id="fu-mentee"
            label={t('mentoring.log.mentee')}
            error={err('menteeId')}
          >
            <Select
              id="fu-mentee"
              aria-invalid={!!errors.menteeId}
              {...form.register('menteeId')}
            >
              <option value="">{t('mentoring.log.chooseMentee')}</option>
              {mine.data?.mentees.map((m) => (
                <option key={m.mentee.id} value={m.mentee.id}>
                  {m.mentee.name}
                </option>
              ))}
            </Select>
            {mine.data?.mentees.length === 0 && (
              <span className="text-[13px] text-ink-subtle">
                {t('mentoring.log.noMentees')}
              </span>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              id="fu-date"
              label={t('mentoring.log.date')}
              error={err('date')}
            >
              <Input
                id="fu-date"
                type="date"
                className="h-11 text-[15px]"
                {...form.register('date')}
              />
            </Field>
            <Field
              id="fu-time"
              label={t('mentoring.log.time')}
              error={err('time')}
            >
              <Input
                id="fu-time"
                type="time"
                className="h-11 text-[15px]"
                {...form.register('time')}
              />
            </Field>
            <Field id="fu-place" label={t('mentoring.log.place')}>
              <Input
                id="fu-place"
                className="h-11 text-[15px]"
                placeholder={t('mentoring.log.placeHint')}
                {...form.register('place')}
              />
            </Field>
          </div>
          <WhenStatus upcoming={upcoming} />
        </Card>

        <Card title={t('mentoring.log.notes')}>
          <Field
            id="fu-shared"
            label={
              <>
                {t('mentoring.log.sharedNotes')}{' '}
                <Hint>{t('mentoring.log.sharedHint')}</Hint>
              </>
            }
          >
            <Textarea
              id="fu-shared"
              rows={3}
              {...form.register('sharedNotes')}
            />
          </Field>
          <Field
            id="fu-private"
            label={
              <>
                {t('mentoring.log.privateNotes')}{' '}
                <Hint>{t('mentoring.log.privateHint')}</Hint>
              </>
            }
          >
            <Textarea
              id="fu-private"
              rows={3}
              {...form.register('privateNotes')}
            />
          </Field>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t('mentoring.log.challenges')}>
            {challenges.fields.map((f, i) => (
              <Row
                key={f.id}
                onRemove={() => challenges.remove(i)}
                removeLabel={t('mentoring.log.remove')}
              >
                <Input
                  aria-label={t('mentoring.log.challenge', { n: i + 1 })}
                  className="h-11 text-[15px]"
                  {...form.register(`challenges.${i}.text`)}
                />
              </Row>
            ))}
            <AddButton onClick={() => challenges.append({ text: '' })}>
              {t('mentoring.log.addChallenge')}
            </AddButton>
          </Card>
          <Card title={t('mentoring.log.tasks')}>
            {tasks.fields.map((f, i) => (
              <Row
                key={f.id}
                onRemove={() => tasks.remove(i)}
                removeLabel={t('mentoring.log.remove')}
              >
                <div className="flex flex-1 flex-wrap gap-2">
                  <Input
                    aria-label={t('mentoring.log.taskTitle', { n: i + 1 })}
                    className="h-11 flex-[2_1_160px] text-[15px]"
                    {...form.register(`tasks.${i}.title`)}
                  />
                  <Input
                    type="date"
                    aria-label={t('mentoring.log.taskDue', { n: i + 1 })}
                    className="h-11 flex-[1_1_140px] text-[15px]"
                    {...form.register(`tasks.${i}.dueOn`)}
                  />
                </div>
              </Row>
            ))}
            <AddButton onClick={() => tasks.append({ title: '', dueOn: '' })}>
              {t('mentoring.log.addTask')}
            </AddButton>
          </Card>
        </div>
        <PlanUpdates
          menteeId={menteeId}
          values={planValues}
          onChange={setPlanValues}
          upcoming={upcoming}
        />

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
      <MenteeContext mentee={selected} />
    </div>
  );
}

function Row({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-subtle hover:bg-surface hover:text-trend-down"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="self-start"
      onClick={onClick}
    >
      <Plus aria-hidden />
      {children}
    </Button>
  );
}
