import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarClock, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupsControllerList, type GroupSummaryDto } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatTime, hasAnyRole } from '@tarbya/shared';
import { Badge, Button } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { gatheringTitle } from '../../../components/groups/format';
import { CreateGroupDialog } from '../../../components/groups/group-dialogs';

/** US-6.1, US-6.7: the groups someone belongs to or oversees. */
export const Route = createFileRoute('/_app/groups/')({
  component: GroupsPage,
});

function GroupsPage() {
  const { t } = useTranslation();
  const me = useMe();
  const [creating, setCreating] = useState(false);
  const isAdmin = hasAnyRole(me.roles, ['SUPER_ADMIN', 'MODERATOR']);
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: async ({ signal }) =>
      (await groupsControllerList({ signal })).data as GroupSummaryDto[],
  });

  return (
    <>
      <Breadcrumbs items={[{ label: t('groups.title') }]} />
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-2xl font-bold text-brand">{t('groups.title')}</h1>
          <p className="text-[15px] text-ink-subtle">{t('groups.lead')}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {t('groups.new')}
          </Button>
        )}
      </div>
      {groups.isError && (
        <p className="text-ink-subtle">{errorMessage(t, groups.error)}</p>
      )}
      {groups.isPending && (
        <p className="text-ink-subtle">{t('admin.common.loading')}</p>
      )}
      {groups.data?.length === 0 && (
        <p className="rounded-card border border-border bg-card p-6 text-ink-subtle">
          {t('groups.none')}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.data?.map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </div>
      {isAdmin && (
        <CreateGroupDialog open={creating} onOpenChange={setCreating} />
      )}
    </>
  );
}

function GroupCard({ group: g }: { group: GroupSummaryDto }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  const next = g.nextGathering;
  return (
    <Link
      to="/groups/$id"
      params={{ id: g.id }}
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-5 hover:border-primary"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-tint font-bold text-primary-hover"
        >
          {g.name.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-bold text-brand">
            {g.name}
          </span>
          <span className="flex items-center gap-1 text-[13px] text-ink-subtle">
            <Users className="size-3.5" aria-hidden />
            {t('groups.members', { count: g.memberCount })}
          </span>
        </div>
        <Badge tone={g.myRole ? 'primary' : 'neutral'}>
          {g.myRole ? t(`groups.role.${g.myRole}`) : t('groups.observer')}
        </Badge>
      </div>
      {g.admin && (
        <span className="text-sm text-ink-muted">
          {t('groups.adminLine')}{' '}
          <strong className="text-ink">{g.admin.name}</strong>
        </span>
      )}
      <span className="flex items-center gap-1.5 text-sm text-ink-muted">
        <CalendarClock className="size-4 text-primary" aria-hidden />
        {next ? (
          <>
            {gatheringTitle(next, locale)} ·{' '}
            {formatDate(next.startsAt, { locale, calendar: me.calendar })} ·{' '}
            <bdi>{formatTime(next.startsAt, { locale })}</bdi>
          </>
        ) : (
          t('groups.noNext')
        )}
      </span>
    </Link>
  );
}
