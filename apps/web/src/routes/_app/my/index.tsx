import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ListChecks, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  feedControllerJourney,
  tasksControllerUpdate,
  type JourneyDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { Button } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { FeedList, feedQueryKey } from '../../../components/feed/feed-list';
import { UpcomingList } from '../../../components/feed/upcoming-list';
import { TrackableCard } from '../../../components/trackables/trackable-card';

/** US-5.1 · design/screens/MyJourney.dc.html */
export const Route = createFileRoute('/_app/my/')({
  component: JourneyPage,
});

const journeyQueryKey = ['dashboard', 'journey'];

function JourneyPage() {
  const { t } = useTranslation();
  const me = useMe();
  const journey = useQuery({
    queryKey: journeyQueryKey,
    queryFn: async ({ signal }) =>
      (await feedControllerJourney({ signal })).data as JourneyDto,
  });

  if (!journey.data) {
    return (
      <p className="text-ink-subtle">
        {journey.isError
          ? errorMessage(t, journey.error)
          : t('admin.common.loading')}
      </p>
    );
  }
  const { mentor, tasks, trackables, upcoming } = journey.data;
  // BR-TRK-4: anything with a cycle waiting to be logged.
  const due = trackables.filter((x) => x.openCycles.length > 0);
  // Done tasks stay listed, struck through, for 7 days (BR-FU-4).
  const open = tasks.filter((x) => !x.doneAt).length;

  return (
    <>
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-ink-subtle">
            {t('journey.eyebrow')}
          </span>
          <h1 className="text-2xl font-bold text-navy">{t('journey.title')}</h1>
        </div>
        <div className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-full bg-navy font-bold text-white"
          >
            {mentor?.name.charAt(0) ?? '?'}
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] text-ink-subtle">
              {t('dashboard.myMentor')}
            </span>
            <span className="font-semibold text-navy">
              {mentor?.name ?? t('journey.noMentor')}
            </span>
          </div>
        </div>
      </header>

      <section
        aria-labelledby="actions-title"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
      >
        <div className="flex items-center gap-2">
          <h2 id="actions-title" className="text-base font-bold text-navy">
            {t('journey.actions')}
          </h2>
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 font-figures text-[13px] font-semibold text-white">
            {due.length + open}
          </span>
        </div>
        {due.length + tasks.length === 0 && (
          <p className="text-ink-subtle">{t('journey.noActions')}</p>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {due.map((x) => (
            <ActionRow
              key={x.id}
              icon={<TrendingUp className="size-4" />}
              iconClass="bg-amber-50 text-warn"
              title={t('trackables.logName', { name: x.name })}
              meta={t('trackables.waiting', { count: x.openCycles.length })}
            >
              <Button asChild size="sm">
                <Link to="/trackables/$id" params={{ id: x.id }}>
                  {t('trackables.log')}
                </Link>
              </Button>
            </ActionRow>
          ))}
          {tasks.map((task) => (
            <TaskAction key={task.id} task={task} calendar={me.calendar} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-navy">{t('trackables.mine')}</h2>
        {trackables.length === 0 ? (
          <p className="text-ink-subtle">{t('trackables.none')}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trackables.map((x) => (
              <TrackableCard key={x.id} trackable={x} />
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-card border border-border bg-card p-4">
          <h2 className="text-base font-bold text-navy">
            {t('dashboard.upcoming')}
          </h2>
          <UpcomingList items={upcoming} />
        </section>
        <section className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-card border border-border bg-card p-4">
          <h2 className="text-base font-bold text-navy">{t('feed.latest')}</h2>
          <FeedList userId={me.id} />
        </section>
      </div>
    </>
  );
}

function TaskAction({
  task,
  calendar,
}: {
  task: JourneyDto['tasks'][number];
  calendar: ReturnType<typeof useMe>['calendar'];
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const me = useMe();
  const done = useMutation({
    mutationFn: () => tasksControllerUpdate(task.id, { done: !task.doneAt }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: journeyQueryKey }),
        queryClient.invalidateQueries({ queryKey: feedQueryKey(me.id) }),
      ]),
  });
  return (
    <ActionRow
      icon={<ListChecks className="size-4" />}
      iconClass="bg-primary-tint text-primary-hover"
      title={t('journey.task', { title: task.title })}
      struck={!!task.doneAt}
      meta={
        task.dueOn
          ? t('journey.due', {
              date: formatDate(new Date(`${task.dueOn}T12:00:00Z`), {
                locale: i18n.language as Language,
                calendar,
              }),
            })
          : t('journey.noDue')
      }
      error={done.isError ? errorMessage(t, done.error) : undefined}
    >
      <Button
        size="sm"
        variant={task.doneAt ? 'ghost' : 'outline'}
        disabled={done.isPending}
        onClick={() => done.mutate()}
      >
        {task.doneAt ? t('journey.undo') : t('journey.markDone')}
      </Button>
    </ActionRow>
  );
}

function ActionRow({
  icon,
  iconClass,
  title,
  struck = false,
  meta,
  error,
  children,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  struck?: boolean;
  meta: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={`grid size-9 shrink-0 place-items-center rounded-full ${iconClass}`}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={
            struck
              ? 'font-semibold text-ink-subtle line-through decoration-2'
              : 'font-semibold text-navy'
          }
        >
          {title}
        </span>
        <span className="text-[13px] text-ink-subtle">{meta}</span>
        {error && (
          <span role="alert" className="text-[13px] text-trend-down">
            {error}
          </span>
        )}
      </div>
      {children}
    </li>
  );
}
