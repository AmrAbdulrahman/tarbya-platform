import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { History, Mail, Phone, Plus } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  profilesControllerGet,
  type ProfileDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { hasAnyRole } from '@tarbya/shared';
import { Badge, Button } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { ChangeLog } from '../../../components/admin/change-log';
import { FeedList } from '../../../components/feed/feed-list';
import { NotesPanel } from '../../../components/mentee/notes-panel';
import { TasksPanel } from '../../../components/mentee/tasks-panel';
import { ChallengesPanel } from '../../../components/mentee/challenges-panel';
import { TrackablesBoard } from '../../../components/trackables/trackables-board';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import {
  LastContact,
  useMyMentees,
} from '../../../components/mentor/last-contact';
import { useLogDialog } from '../../../components/mentor/log-dialog';
import { TrendCards } from '../../../components/trackables/trend-cards';
import { CollapsibleSection } from '../../../components/collapsible-section';
import { RoleChips } from '../../../components/role-chips';
import { PageHeader } from '../../../components/page-header';

/** A member's profile, and for their mentor the full mentee profile (US-4.2 · design/screens/Mentee.dc.html). */
export const Route = createFileRoute('/_app/people/$id')({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const me = useMe();
  const { id } = Route.useParams();
  const { mentees } = useMyMentees();
  const openLog = useLogDialog();
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: async ({ signal }) =>
      (await profilesControllerGet(id, { signal })).data as ProfileDto,
  });

  if (!profile.data) {
    return (
      <p className="text-ink-subtle">
        {profile.isError
          ? errorMessage(t, profile.error)
          : t('admin.common.loading')}
      </p>
    );
  }
  const p = profile.data;
  const isAdmin = hasAnyRole(me.roles, ['SUPER_ADMIN', 'MODERATOR']);
  const myMentee = mentees.find((m) => m.mentee.id === p.id);
  return (
    <>
      <Breadcrumbs
        items={[
          ...(p.isMentor
            ? [{ label: t('nav.menteeDashboard'), to: '/mentor' }]
            : isAdmin
              ? [{ label: t('nav.users'), to: '/admin/users' }]
              : []),
          { label: p.name },
        ]}
      />
      <PageHeader className="flex-row flex-wrap items-center gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-tint text-lg font-bold text-primary-hover"
        >
          {p.name.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-brand">{p.name}</h1>
            <div
              className="flex flex-wrap gap-1"
              aria-label={t('profile.roles')}
            >
              <RoleChips roles={p.roles} />
              {p.deactivatedAt && (
                <Badge tone="danger">{t('profile.deactivated')}</Badge>
              )}
            </div>
          </div>
          <dl
            aria-label={t('profile.contact')}
            className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-ink-subtle"
          >
            {p.email && (
              <Detail icon={<Mail />} label={t('profile.email')}>
                <bdi>{p.email}</bdi>
              </Detail>
            )}
            {p.phone && (
              <Detail icon={<Phone />} label={t('profile.phone')}>
                <bdi>{p.phone}</bdi>
              </Detail>
            )}
            {p.mentor && (
              <Detail label={t('profile.mentor')}>
                <PersonLink user={p.mentor} />
              </Detail>
            )}
            {p.manager && (
              <Detail label={t('profile.manager')}>
                <PersonLink user={p.manager} />
              </Detail>
            )}
          </dl>
          {myMentee && <LastContact mentee={myMentee} />}
        </div>
        {p.isMentor && (
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => openLog('follow-up', p.id)}
          >
            <Plus aria-hidden />
            {t('mentee.logFollowUp')}
          </Button>
        )}
      </PageHeader>

      {p.canSeeMentoring ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <TrendCards menteeId={p.id} />
            <TrackablesBoard menteeId={p.id} canManage={p.canManageMentoring} />
            <CollapsibleSection
              defaultOpen
              title={t('feed.title')}
              icon={<History className="size-4 text-primary" aria-hidden />}
            >
              <FeedList userId={p.id} />
            </CollapsibleSection>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <TasksPanel menteeId={p.id} canManage={p.canManageMentoring} />
            <ChallengesPanel menteeId={p.id} canManage={p.canManageMentoring} />
            <NotesPanel mentee={p} canWrite={p.canWriteNotes} />
          </div>
        </div>
      ) : (
        p.canWriteNotes && <NotesPanel mentee={p} canWrite />
      )}
      {isAdmin && <ChangeLog userId={p.id} />}
    </>
  );
}

function Detail({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {icon ? (
        <dt className="[&_svg]:size-3.5">
          <span className="sr-only">{label}</span>
          <span aria-hidden>{icon}</span>
        </dt>
      ) : (
        <dt>{label}:</dt>
      )}
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}

function PersonLink({ user }: { user: UserRefDto | null }) {
  const { t } = useTranslation();
  if (!user)
    return <span className="text-ink-subtle">{t('profile.none')}</span>;
  return (
    <Link
      to="/people/$id"
      params={{ id: user.id }}
      className="text-primary hover:text-primary-hover"
    >
      {user.name}
    </Link>
  );
}
