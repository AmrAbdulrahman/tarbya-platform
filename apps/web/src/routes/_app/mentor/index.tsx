import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { MessageCircle, Plus } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  feedControllerMentor,
  messagesControllerDirect,
  type DashboardMenteeDto,
  type MentorDashboardDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { daysSince, formatDate } from '@tarbya/shared';
import { Badge, cn, useToast } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { UpcomingList } from '../../../components/feed/upcoming-list';
import { useLogDialog } from '../../../components/mentor/log-dialog';
import { useCycleLabel } from '../../../components/trackables/format';
import { Sparkline, TrendBadge } from '../../../components/trackables/trend';
import { PageHeader } from '../../../components/page-header';

/** US-4.1 · design/screens/Main.dc.html */
export const Route = createFileRoute('/_app/mentor/')({
  component: MentorDashboard,
});

export const dashboardQueryKey = ['dashboard', 'mentor'];

type Filter = 'all' | 'contact' | 'worse';

const contactTone = {
  REGULAR: 'success',
  DUE: 'warn',
  LATE: 'danger',
} as const;
const contactDot = {
  REGULAR: 'bg-trend-up',
  DUE: 'bg-warn',
  LATE: 'bg-trend-down',
} as const;

function MentorDashboard() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const [filter, setFilter] = useState<Filter>('all');
  const dashboard = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: async ({ signal }) =>
      (await feedControllerMentor({ signal })).data as MentorDashboardDto,
  });

  const header = (
    <PageHeader>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm text-ink-subtle">
          {formatDate(new Date(), {
            locale: i18n.language as Language,
            calendar: me.calendar,
          })}
        </span>
        <h1 className="text-2xl font-bold text-brand">
          {t('dashboard.greeting', { name: me.name.split(' ')[0] })}
        </h1>
      </div>
    </PageHeader>
  );

  if (!dashboard.data) {
    return (
      <>
        {header}
        <p className="text-ink-subtle">
          {dashboard.isError
            ? errorMessage(t, dashboard.error)
            : t('admin.common.loading')}
        </p>
      </>
    );
  }
  const { stats, mentees, upcoming, mentor } = dashboard.data;
  const shown = mentees.filter((m) =>
    filter === 'contact'
      ? m.contactStatus !== 'REGULAR'
      : filter === 'worse'
        ? m.worseningTrackables > 0
        : true,
  );

  return (
    <>
      {header}

      <section
        aria-label={t('dashboard.summary')}
        className="grid grid-cols-2 overflow-hidden rounded-card border border-border bg-card lg:grid-cols-4"
      >
        <Kpi
          label={t('dashboard.mentees')}
          value={stats.mentees}
          sub={t('dashboard.withTasks', {
            count: mentees.filter((m) => m.openTasks > 0).length,
          })}
        />
        <Kpi
          label={t('dashboard.needContact')}
          value={stats.needContact}
          sub={t('dashboard.needContactSub')}
          tone={stats.needContact ? 'text-trend-down' : undefined}
        />
        <Kpi
          label={t('dashboard.month')}
          value={stats.monthFollowUps + stats.monthActivities}
          sub={t('dashboard.monthSub', {
            followUps: stats.monthFollowUps,
            activities: stats.monthActivities,
          })}
        />
        <Kpi
          label={t('dashboard.improving')}
          value={
            <>
              {stats.improving}
              <span className="text-lg text-ink-subtle">
                /{stats.activeTrackables}
              </span>
            </>
          }
          sub={t('dashboard.improvingSub', {
            steady: stats.steady,
            worse: stats.worse,
          })}
        />
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[2_1_620px] flex-col overflow-hidden rounded-card border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
            <h2 className="flex-1 text-base font-bold text-brand">
              {t('dashboard.mentees')}
            </h2>
            <div
              role="group"
              aria-label={t('dashboard.filter')}
              className="flex gap-1 rounded-lg bg-surface p-1"
            >
              {(['all', 'contact', 'worse'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'h-8 rounded-md px-3 text-sm font-medium text-ink-muted',
                    filter === f && 'bg-card text-primary shadow-sm',
                  )}
                >
                  {t(
                    f === 'all'
                      ? 'dashboard.filterAll'
                      : f === 'contact'
                        ? 'dashboard.filterContact'
                        : 'dashboard.filterWorse',
                  )}
                </button>
              ))}
            </div>
          </div>
          {mentees.length === 0 ? (
            <p className="px-6 py-5 text-ink-subtle">
              {t('mentoring.log.noMentees')}
            </p>
          ) : shown.length === 0 ? (
            <p className="px-6 py-5 text-ink-subtle">
              {t('dashboard.emptyFilter')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[15px]">
                <thead>
                  <tr className="text-start text-[13px] text-ink-subtle">
                    <th className="px-6 py-3 text-start font-medium">
                      {t('dashboard.member')}
                    </th>
                    <th className="px-3 py-3 text-start font-medium">
                      {t('dashboard.lastContact')}
                    </th>
                    <th className="px-3 py-3 text-start font-medium">
                      {t('dashboard.mainPlan')}
                    </th>
                    <th className="px-3 py-3 text-start font-medium">
                      {t('dashboard.trend')}
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((m) => (
                    <MenteeRow key={m.mentorshipId} row={m} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <Panel title={t('dashboard.upcoming')}>
            <UpcomingList items={upcoming} />
          </Panel>
          {mentor && (
            <Panel
              title={t('dashboard.myMentor')}
              aside={<Badge tone="primary">{t('dashboard.alsoMentee')}</Badge>}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-bold text-white"
                >
                  {mentor.user.name.charAt(0)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold text-brand">
                    {mentor.user.name}
                  </span>
                  <span className="text-[13px] text-ink-subtle">
                    {t('dashboard.mentorContact', {
                      when: mentor.lastContactAt
                        ? t('mentoring.log.daysAgo', {
                            count: daysSince(
                              new Date(mentor.lastContactAt),
                              new Date(),
                            ),
                          })
                        : t('dashboard.never'),
                    })}{' '}
                    ·{' '}
                    <Link to="/my" className="text-primary hover:underline">
                      {t('dashboard.mentorPlans', {
                        count: mentor.activeTrackables,
                      })}
                    </Link>
                  </span>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

/** The whole row opens the mentee's page; its own links and buttons keep their job. */
function MenteeRow({ row }: { row: DashboardMenteeDto }) {
  const { t } = useTranslation();
  const openLog = useLogDialog();
  const navigate = useNavigate();
  const toast = useToast();
  const trackable = row.mainTrackable;
  const cycleLabel = useCycleLabel();
  const message = useMutation({
    mutationFn: () => messagesControllerDirect({ userId: row.mentee.id }),
    onSuccess: (res) =>
      navigate({ to: '/messages', search: { c: res.data.id } }),
    onError: (error) => toast(errorMessage(t, error)),
  });
  const openProfile = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    void navigate({ to: '/people/$id', params: { id: row.mentee.id } });
  };
  return (
    <tr
      onClick={openProfile}
      className="cursor-pointer transition-colors hover:bg-primary-tint/40"
    >
      <td className="px-6 py-3.5">
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-tint font-bold text-primary-hover"
          >
            {row.mentee.name.charAt(0)}
          </span>
          <span className="flex flex-col">
            <Link
              to="/people/$id"
              params={{ id: row.mentee.id }}
              className="font-semibold text-brand hover:text-primary"
            >
              {row.mentee.name}
            </Link>
            {row.openChallenges > 0 && (
              <span className="text-[13px] text-warn">
                {t('dashboard.openChallenges', { count: row.openChallenges })}
              </span>
            )}
          </span>
        </span>
      </td>
      <td className="px-3 py-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className={cn(
                'size-2 rounded-full',
                contactDot[row.contactStatus],
              )}
            />
            {row.lastContactAt
              ? t('mentoring.log.daysAgo', { count: row.daysSinceContact })
              : t('dashboard.never')}
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-ink-subtle">
            <Badge
              tone={contactTone[row.contactStatus]}
              className="h-5 px-2 text-xs"
            >
              {t(`mentoring.log.status.${row.contactStatus}`)}
            </Badge>
            {row.lastContactKind && t(`feed.kind.${row.lastContactKind}`)}
          </span>
        </span>
      </td>
      <td className="px-3 py-3.5">
        {trackable ? (
          <span className="flex flex-col gap-0.5">
            <Link
              to="/trackables/$id"
              params={{ id: trackable.id }}
              className="font-medium text-brand hover:text-primary"
            >
              {trackable.name}
            </Link>
            <span className="text-[13px] text-ink-subtle">
              {trackable.latestCycle
                ? t('dashboard.updated', {
                    when: cycleLabel(
                      trackable.latestCycle,
                      trackable.cycle,
                      trackable.weekday,
                    ),
                  })
                : t('dashboard.noReadings')}
            </span>
          </span>
        ) : (
          <span className="text-ink-subtle">{t('dashboard.noPlan')}</span>
        )}
      </td>
      <td className="px-3 py-3.5">
        {trackable && (
          <span className="flex items-center gap-3">
            {trackable.points.length > 1 && (
              <span className="w-24">
                <Sparkline
                  points={trackable.points}
                  target={trackable.target}
                  trend={trackable.trend}
                  height={32}
                  label={t('trackables.chart', {
                    trend: t(`trackables.trend.${trackable.trend}`),
                  })}
                />
              </span>
            )}
            <TrendBadge trend={trackable.trend} />
          </span>
        )}
      </td>
      <td className="px-6 py-3.5">
        <span className="flex items-center justify-end gap-1">
          <button
            type="button"
            disabled={message.isPending}
            onClick={() => message.mutate()}
            aria-label={t('dashboard.messageWith', { name: row.mentee.name })}
            title={t('dashboard.messageWith', { name: row.mentee.name })}
            className="grid size-9 place-items-center rounded-full text-primary hover:bg-primary-tint hover:text-primary-hover disabled:opacity-50"
          >
            <MessageCircle className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => openLog('follow-up', row.mentee.id)}
            aria-label={t('dashboard.contactWith', { name: row.mentee.name })}
            title={t('dashboard.contactWith', { name: row.mentee.name })}
            className="grid size-9 place-items-center rounded-full text-primary hover:bg-primary-tint hover:text-primary-hover"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </span>
      </td>
    </tr>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-border px-6 py-5 [&:not(:first-child)]:border-s max-lg:[&:nth-child(3)]:border-s-0 max-lg:[&:nth-child(n+3)]:border-t">
      <span className="text-sm text-ink-subtle">{label}</span>
      <span
        className={cn('font-figures text-3xl font-semibold text-brand', tone)}
      >
        {value}
      </span>
      <span className="text-[13px] text-ink-subtle">{sub}</span>
    </div>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-bold text-brand">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
