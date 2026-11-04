import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ListChecks,
  Mountain,
  NotebookPen,
  Plus,
  TrendingUp,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { interactionsControllerCreateFollowUp } from '@tarbya/api-client';
import { fromZoned, toZoned } from '@tarbya/shared';
import { Button, Input, Textarea } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from '../login/fields';
import { ChallengeNotes, type ChallengeNote } from './challenge-notes';
import { Hint, mineQueryKey, Section, WhenStatus } from './form-parts';
import { TrackableUpdates } from './trackable-updates';

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'validation.required'),
  place: z.string().max(200),
  sharedNotes: z.string().max(5000),
  privateNotes: z.string().max(5000),
  challenges: z.array(z.object({ text: z.string().max(300) })),
  tasks: z.array(z.object({ title: z.string().max(200), dueOn: z.string() })),
});
type Values = z.infer<typeof schema>;

function blank(): Values {
  const now = toZoned(new Date());
  return {
    date: now.date,
    time: now.time,
    place: '',
    sharedNotes: '',
    privateNotes: '',
    challenges: [],
    tasks: [],
  };
}

/**
 * US-4.3 · design/screens/FollowUp.dc.html: when, then the mentee's trends with
 * this cycle's values, challenges, tasks and notes.
 */
export function FollowUpForm({
  menteeId,
  onSaved,
  onCancel,
}: {
  menteeId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: blank(),
  });
  const [trackableValues, setTrackableValues] = useState<
    Record<string, string>
  >({});
  const [challengeNotes, setChallengeNotes] = useState<
    Record<string, ChallengeNote>
  >({});
  const challenges = useFieldArray({
    control: form.control,
    name: 'challenges',
  });
  const tasks = useFieldArray({ control: form.control, name: 'tasks' });
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (v: Values) =>
      interactionsControllerCreateFollowUp({
        menteeId,
        startsAt: fromZoned({ date: v.date, time: v.time }).toISOString(),
        place: v.place || null,
        sharedNotes: v.sharedNotes || null,
        privateNotes: v.privateNotes || null,
        challenges: v.challenges.map((c) => c.text).filter((c) => c.trim()),
        tasks: v.tasks
          .filter((task) => task.title.trim())
          .map((task) => ({ title: task.title, dueOn: task.dueOn || null })),
        trackableUpdates: Object.entries(trackableValues)
          .filter(
            ([, value]) =>
              value.trim() !== '' && Number.isFinite(Number(value)),
          )
          .map(([trackableId, value]) => ({
            trackableId,
            value: Number(value),
          })),
        challengeNotes: Object.entries(challengeNotes)
          .filter(([, n]) => n.comment.trim() || n.resolve)
          .map(([challengeId, n]) => ({
            challengeId,
            comment: n.comment.trim() || null,
            resolve: n.resolve,
          })),
      }),
    onSuccess: async () => {
      onSaved();
      await Promise.all(
        [
          mineQueryKey,
          ['trackables'],
          ['challenges', menteeId],
          ['dashboard'],
          ['feed'],
          ['tasks', menteeId],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });

  const [date, time] = form.watch(['date', 'time']);
  const upcoming =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
      ? fromZoned({ date, time }) > new Date()
      : false;
  const err = (name: 'date' | 'time') =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.required')
      : undefined;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            id="fu-date"
            label={t('mentoring.log.date')}
            error={err('date')}
          >
            <Input id="fu-date" type="date" {...form.register('date')} />
          </Field>
          <Field
            id="fu-time"
            label={t('mentoring.log.time')}
            error={err('time')}
          >
            <Input id="fu-time" type="time" {...form.register('time')} />
          </Field>
          <Field id="fu-place" label={t('mentoring.log.place')}>
            <Input
              id="fu-place"
              placeholder={t('mentoring.log.placeHint')}
              {...form.register('place')}
            />
          </Field>
        </div>
        <WhenStatus upcoming={upcoming} />
      </div>

      <Section title={t('trackables.trends')} icon={<TrendingUp />}>
        <TrackableUpdates
          menteeId={menteeId}
          values={trackableValues}
          onChange={setTrackableValues}
          upcoming={upcoming}
        />
      </Section>

      <Section boxed title={t('mentoring.log.challenges')} icon={<Mountain />}>
        <ChallengeNotes
          menteeId={menteeId}
          notes={challengeNotes}
          onChange={setChallengeNotes}
        />
        {challenges.fields.map((f, i) => (
          <Row
            key={f.id}
            onRemove={() => challenges.remove(i)}
            removeLabel={t('mentoring.log.remove')}
          >
            <Input
              aria-label={t('mentoring.log.challenge', { n: i + 1 })}
              {...form.register(`challenges.${i}.text`)}
            />
          </Row>
        ))}
        <AddButton onClick={() => challenges.append({ text: '' })}>
          {t('mentoring.log.addChallenge')}
        </AddButton>
      </Section>

      <Section boxed title={t('mentoring.log.tasks')} icon={<ListChecks />}>
        {tasks.fields.map((f, i) => (
          <Row
            key={f.id}
            onRemove={() => tasks.remove(i)}
            removeLabel={t('mentoring.log.remove')}
          >
            <div className="flex flex-1 flex-wrap gap-2">
              <Input
                aria-label={t('mentoring.log.taskTitle', { n: i + 1 })}
                className="flex-[2_1_160px]"
                {...form.register(`tasks.${i}.title`)}
              />
              <Input
                type="date"
                aria-label={t('mentoring.log.taskDue', { n: i + 1 })}
                className="flex-[1_1_140px]"
                {...form.register(`tasks.${i}.dueOn`)}
              />
            </div>
          </Row>
        ))}
        <AddButton onClick={() => tasks.append({ title: '', dueOn: '' })}>
          {t('mentoring.log.addTask')}
        </AddButton>
      </Section>

      <Section boxed title={t('mentoring.log.notes')} icon={<NotebookPen />}>
        <Field
          id="fu-shared"
          label={
            <>
              {t('mentoring.log.sharedNotes')}{' '}
              <Hint>{t('mentoring.log.sharedHint')}</Hint>
            </>
          }
        >
          <Textarea id="fu-shared" rows={2} {...form.register('sharedNotes')} />
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
            rows={2}
            {...form.register('privateNotes')}
          />
        </Field>
      </Section>

      <FormError
        message={save.isError ? errorMessage(t, save.error) : undefined}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('mentoring.log.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('admin.common.cancel')}
        </Button>
      </div>
    </form>
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
