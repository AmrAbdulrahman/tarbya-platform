import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Info, Pencil, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  groupsControllerGatheringsOf,
  groupsControllerGet,
  type GatheringPageDto,
  type GatheringSummaryDto,
  type GroupDto,
  type SeriesDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatTime } from '@tarbya/shared';
import { Badge, Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { lookupColors } from '../../../components/admin/lookup-colors';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import {
  gatheringTitle,
  groupQueryKey,
  typeName,
  weekdayName,
} from '../../../components/groups/format';
import { GatheringPanel } from '../../../components/groups/gathering-panel';
import {
  AddMemberDialog,
  GroupTypeDialog,
  OneOffDialog,
  RolesDialog,
  SeriesDialog,
} from '../../../components/groups/group-dialogs';

/** US-6.2…6.7 · design/screens/Group.dc.html */
export const Route = createFileRoute('/_app/groups/$id')({
  validateSearch: (search: Record<string, unknown>): { gathering?: string } =>
    typeof search['gathering'] === 'string'
      ? { gathering: search['gathering'] }
      : {},
  component: GroupPage,
});

type Open = 'member' | 'roles' | 'series' | 'oneOff' | 'type' | null;

function GroupPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { gathering: picked } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [open, setOpen] = useState<Open>(null);
  const [editSeries, setEditSeries] = useState<SeriesDto | null>(null);
  const [pastLimit, setPastLimit] = useState(6);

  const group = useQuery({
    queryKey: groupQueryKey(id),
    queryFn: async ({ signal }) =>
      (await groupsControllerGet(id, { signal })).data as GroupDto,
  });
  const upcoming = useQuery({
    queryKey: ['group-gatherings', id, 'upcoming'],
    queryFn: async ({ signal }) =>
      (
        await groupsControllerGatheringsOf(
          id,
          { when: 'upcoming', limit: 6 },
          { signal },
        )
      ).data as GatheringPageDto,
  });
  const past = useQuery({
    queryKey: ['group-gatherings', id, 'past', pastLimit],
    queryFn: async ({ signal }) =>
      (
        await groupsControllerGatheringsOf(
          id,
          { when: 'past', limit: pastLimit },
          { signal },
        )
      ).data as GatheringPageDto,
  });

  if (!group.data) {
    return (
      <p className="text-ink-subtle">
        {group.isError
          ? errorMessage(t, group.error)
          : t('admin.common.loading')}
      </p>
    );
  }
  const g = group.data;
  const select = (gathering: string) =>
    navigate({ search: { gathering }, replace: true });
  const current =
    picked ?? g.nextGathering?.id ?? past.data?.items[0]?.id ?? null;
  const close = (v: boolean) => !v && setOpen(null);

  return (
    <>
      <Breadcrumbs
        items={[{ label: t('groups.title'), to: '/groups' }, { label: g.name }]}
      />
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-subtle">
            {t('groups.eyebrow')} ·{' '}
            {t('groups.members', { count: g.memberCount })}
          </span>
          <h1 className="text-3xl font-bold text-brand">{g.name}</h1>
          {g.description && (
            <p className="text-[15px] text-ink-muted">{g.description}</p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
            {g.admin && (
              <span>
                {t('groups.adminLine')}{' '}
                <strong className="text-ink">{g.admin.name}</strong>
              </span>
            )}
            {g.moderators.length > 0 && (
              <span>
                {t('groups.moderatorsLine')}{' '}
                <strong className="text-ink">
                  {g.moderators.map((m) => m.name).join('، ')}
                </strong>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {g.canManageRoles && (
            <Button variant="outline" onClick={() => setOpen('roles')}>
              <ShieldCheck aria-hidden />
              {t('groups.manageRoles')}
            </Button>
          )}
          {g.canManage && (
            <>
              <Button variant="outline" onClick={() => setOpen('member')}>
                <UserPlus aria-hidden />
                {t('groups.addMember')}
              </Button>
              <Button onClick={() => setOpen('oneOff')}>
                <Plus aria-hidden />
                {t('groups.addOneOff')}
              </Button>
            </>
          )}
        </div>
      </header>

      {!g.myRole && !g.canManage && (
        <p className="flex items-start gap-2 rounded-card border border-border bg-card px-4 py-3 text-sm text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t('groups.chainNote')}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-4">
          {current ? (
            <GatheringPanel gatheringId={current} />
          ) : (
            <p className="rounded-card border border-border bg-card p-5 text-ink-subtle">
              {t('groups.noUpcoming')}
            </p>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Card
            title={t('groups.upcoming')}
            action={
              g.canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen('series')}
                >
                  <Plus aria-hidden />
                  {t('groups.addSeries')}
                </Button>
              )
            }
          >
            <GatheringList
              items={upcoming.data?.items}
              current={current}
              onPick={select}
              empty={t('groups.noUpcoming')}
            />
          </Card>

          <Card title={t('groups.series')}>
            {g.series.length === 0 && (
              <p className="text-sm text-ink-subtle">{t('groups.noSeries')}</p>
            )}
            <ul className="flex flex-col gap-3">
              {g.series.map((s) => (
                <SeriesItem
                  key={s.id}
                  series={s}
                  onEdit={g.canManage ? () => setEditSeries(s) : undefined}
                />
              ))}
            </ul>
          </Card>

          <Card title={t('groups.past')}>
            <GatheringList
              items={past.data?.items}
              current={current}
              onPick={select}
              empty={t('groups.noPast')}
              showCounts
            />
            {past.data?.nextCursor && (
              <Button
                variant="link"
                size="sm"
                className="self-start px-0"
                onClick={() => setPastLimit((n) => n + 6)}
              >
                {t('feed.more')}
              </Button>
            )}
          </Card>

          {g.canManage && (
            <Card
              title={t('groups.oneOffTypes')}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen('type')}
                >
                  <Plus aria-hidden />
                  {t('groups.newType')}
                </Button>
              }
            >
              <TypeChips group={g} />
            </Card>
          )}
        </aside>
      </div>

      {g.canManage && (
        <>
          <AddMemberDialog
            group={g}
            open={open === 'member'}
            onOpenChange={close}
          />
          <SeriesDialog
            key={open === 'series' ? 'new' : 'closed'}
            group={g}
            open={open === 'series'}
            onOpenChange={close}
          />
          {editSeries && (
            <SeriesDialog
              group={g}
              series={editSeries}
              open
              onOpenChange={(v) => !v && setEditSeries(null)}
            />
          )}
          <OneOffDialog
            key={open === 'oneOff' ? 'new' : 'closed'}
            group={g}
            open={open === 'oneOff'}
            onOpenChange={close}
            onCreated={select}
          />
          <GroupTypeDialog
            group={g}
            open={open === 'type'}
            onOpenChange={close}
          />
        </>
      )}
      {g.canManageRoles && (
        <RolesDialog group={g} open={open === 'roles'} onOpenChange={close} />
      )}
    </>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-bold text-brand">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function GatheringList({
  items,
  current,
  onPick,
  empty,
  showCounts,
}: {
  items?: GatheringSummaryDto[];
  current: string | null;
  onPick: (id: string) => void;
  empty: string;
  showCounts?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  if (!items) return null;
  if (!items.length) return <p className="text-sm text-ink-subtle">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((x) => {
        const present = x.counts.present;
        return (
          <li key={x.id}>
            <button
              type="button"
              aria-current={x.id === current || undefined}
              onClick={() => onPick(x.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start hover:bg-surface',
                x.id === current && 'bg-primary-tint/60',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    'truncate text-[15px] font-semibold text-brand',
                    x.cancelledAt && 'text-ink-subtle line-through',
                  )}
                >
                  {gatheringTitle(x, locale)}
                </span>
                <span className="text-[13px] text-ink-subtle">
                  {formatDate(x.startsAt, { locale, calendar: me.calendar })} ·{' '}
                  <bdi>{formatTime(x.startsAt, { locale })}</bdi>
                </span>
              </span>
              {x.cancelledAt ? (
                <Badge tone="danger">{t('groups.cancelled')}</Badge>
              ) : showCounts ? (
                <span className="font-figures text-sm font-semibold text-ink-muted">
                  <span dir="ltr">
                    {present ?? '—'}/{x.counts.members}
                  </span>
                </span>
              ) : x.isMember && x.myRsvp ? (
                <Badge tone={x.myRsvp === 'ATTENDING' ? 'success' : 'warn'}>
                  {t(`groups.rsvp.${x.myRsvp}`)}
                </Badge>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SeriesItem({
  series: s,
  onEdit,
}: {
  series: SeriesDto;
  onEdit?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  return (
    <li className="flex items-start gap-2 rounded-lg bg-surface p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold text-brand">
          {s.title || typeName(s.activityType, locale)}
        </span>
        <span className="text-[13px] text-ink-muted">
          {t('groups.every', {
            count: s.intervalWeeks,
            weekday: weekdayName(s.weekday, locale),
          })}{' '}
          · <bdi>{s.time}</bdi> · {typeName(s.activityType, locale)}
          {s.place && <> · {s.place}</>}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {s.activityType.reminder !== 'NONE' && (
            <Badge>{t(`groups.reminderLead.${s.activityType.reminder}`)}</Badge>
          )}
          {s.activityType.requiresRsvp && (
            <Badge tone="primary">{t('groups.requiresRsvp')}</Badge>
          )}
        </span>
      </div>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('groups.editSeries')}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
      )}
    </li>
  );
}

function TypeChips({ group }: { group: GroupDto }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const types = group.activityTypes.filter((x) => x.scope === 'GROUP_ONE_OFF');
  if (!types.length)
    return <p className="text-sm text-ink-subtle">{t('groups.noTypes')}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {types.map((x) => {
        const c = lookupColors[x.color];
        return (
          <li
            key={x.id}
            style={{ backgroundColor: c.tint, color: c.text }}
            className="rounded-full px-3 py-1 text-sm font-medium"
          >
            {typeName(x, locale)}
          </li>
        );
      })}
    </ul>
  );
}
