import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { feedControllerJourney, type JourneyDto } from '@tarbya/api-client';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { FeedList } from '../../../components/feed/feed-list';
import { UpcomingList } from '../../../components/feed/upcoming-list';
import { TasksPanel } from '../../../components/mentee/tasks-panel';
import { Avatar } from '../../../components/profile/avatar';
import { TrackableCard } from '../../../components/trackables/trackable-card';
import { TrackablesBoard } from '../../../components/trackables/trackables-board';

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
  const { mentor, trackables, upcoming } = journey.data;

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
          {mentor ? (
            <Avatar
              name={mentor.name}
              url={mentor.avatarUrl}
              className="size-10"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-full bg-navy font-bold text-white"
            >
              ?
            </span>
          )}
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

      {trackables.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trackables.map((x) => (
            <TrackableCard key={x.id} trackable={x} />
          ))}
        </div>
      )}

      {/* The same tracking view as "My trackables", then the action items (US-5.1). */}
      <TrackablesBoard menteeId={me.id} canManage={false} isMentee />
      <TasksPanel menteeId={me.id} />

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
