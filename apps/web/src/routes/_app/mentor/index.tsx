import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  feedControllerMentor,
  type DashboardMenteeDto,
  type MentorDashboardDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { daysSince, formatDate } from '@tarbya/shared';
import { Badge, Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { UpcomingList } from '../../../components/feed/upcoming-list';
import { Sparkline, TrendBadge } from '../../../components/plans/trend';

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
    <header className="flex flex-wrap items-end gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm text-ink-subtle">
          {formatDate(new Date(), {
            locale: i18n.language as Language,
            calendar: me.calendar,
          })}
        </span>
        <h1 className="text-3xl font-bold text-navy">
          {t('dashboard.greeting', { name: me.name.split(' ')[0] })}
        </h1>
      </div>
      <Button asChild>
        <Link to="/mentor/log">
          <Plus aria-hidden />
          {t('dashboard.newFollowUp')}
        </Link>
      </Button>
    </header>
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
        ? m.worseningPlans > 0
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
                /{stats.openPlans}
              </span>
            </>
          }
          sub={t('dashboard.improvingSub', {
            steady: stats.steady,
            worse: stats.worse,
          })}
        />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[2_1_620px] flex-col overflow-hidden rounded-card border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
            <h2 className="flex-1 text-lg font-bold text-navy">
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

        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-6">
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
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-navy font-bold text-white"
                >
                  {mentor.user.name.charAt(0)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold text-navy">
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
                      {t('dashboard.mentorPlans', { count: mentor.openPlans })}
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

function MenteeRow({ row }: { row: DashboardMenteeDto }) {
  const { t } = useTranslation();
  const plan = row.mainPlan;
  return (
    <tr>
      <td className="px-6 py-3.5">
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-tint font-bold text-primary-hover"
          >
            {row.mentee.name.charAt(0)}
          </span>
          <Link
            to="/people/$id"
            params={{ id: row.mentee.id }}
            className="font-semibold text-navy hover:text-primary"
          >
            {row.mentee.name}
          </Link>
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
        {plan ? (
          <span className="flex flex-col gap-0.5">
            <Link
              to="/plans/$id"
              params={{ id: plan.id }}
              className="font-medium text-navy hover:text-primary"
            >
              {plan.name}
            </Link>
            <span className="text-[13px] text-ink-subtle">
              {plan.latestAt
                ? t('dashboard.updated', {
                    when: t('mentoring.log.daysAgo', {
                      count: daysSince(new Date(plan.latestAt), new Date()),
                    }),
                  })
                : t('dashboard.noReadings')}
            </span>
          </span>
        ) : (
          <span className="text-ink-subtle">{t('dashboard.noPlan')}</span>
        )}
      </td>
      <td className="px-3 py-3.5">
        {plan && (
          <span className="flex items-center gap-3">
            {plan.points.length > 1 && (
              <span className="w-24">
                <Sparkline
                  points={plan.points}
                  target={plan.target}
                  trend={plan.trend}
                  height={32}
                  label={t('plans.chart', {
                    trend: t(`plans.trend.${plan.trend}`),
                  })}
                />
              </span>
            )}
            <TrendBadge trend={plan.trend} />
          </span>
        )}
      </td>
      <td className="px-6 py-3.5 text-end">
        <Link
          to="/mentor/log"
          search={{ menteeId: row.mentee.id }}
          aria-label={t('dashboard.contactWith', { name: row.mentee.name })}
          className="whitespace-nowrap text-sm font-semibold text-primary hover:text-primary-hover"
        >
          {t('dashboard.contact')}
        </Link>
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
        className={cn('font-figures text-3xl font-semibold text-navy', tone)}
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
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-bold text-navy">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
