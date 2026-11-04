import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { History, Mail, Phone } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  profilesControllerAddNote,
  profilesControllerEditNote,
  profilesControllerGet,
  profilesControllerNotes,
  type AdminNoteDto,
  type ProfileDto,
  type UserRefDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, hasAnyRole } from '@tarbya/shared';
import { Badge, Button, Textarea } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { FormError } from '../../../components/login/fields';
import { actedBy } from '../../../components/acted-by';
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
import { TrendCards } from '../../../components/trackables/trend-cards';
import { CollapsibleSection } from '../../../components/collapsible-section';
import { RoleChips } from '../../../components/role-chips';

/** A member's profile, and for their mentor the full mentee profile (US-4.2 · design/screens/Mentee.dc.html). */
export const Route = createFileRoute('/_app/people/$id')({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const me = useMe();
  const { id } = Route.useParams();
  const { mentees } = useMyMentees();
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
      <header className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-tint text-lg font-bold text-primary-hover"
        >
          {p.name.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-navy">{p.name}</h1>
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
      </header>

      {p.canSeeMentoring ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <TrendCards menteeId={p.id} />
            <TrackablesBoard menteeId={p.id} canManage={p.canManageMentoring} />
            <CollapsibleSection
              title={t('feed.title')}
              icon={<History className="size-4 text-primary" aria-hidden />}
            >
              <FeedList userId={p.id} />
            </CollapsibleSection>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <TasksPanel menteeId={p.id} canManage={p.canManageMentoring} />
            <ChallengesPanel menteeId={p.id} canManage={p.canManageMentoring} />
            <NotesPanel mentee={p} canWrite={p.isMentor} />
            {p.canSeeAdminNotes && <AdminNotes subjectId={p.id} />}
          </div>
        </div>
      ) : (
        p.canSeeAdminNotes && <AdminNotes subjectId={p.id} />
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

/** Seen and written only by those who manage or mentor the member, and moderators. */
function AdminNotes({ subjectId }: { subjectId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['admin-notes', subjectId];
  const notes = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await profilesControllerNotes(subjectId, { signal }))
        .data as AdminNoteDto[],
  });
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: () => profilesControllerAddNote(subjectId, { body }),
    onSuccess: async () => {
      setBody('');
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) add.mutate();
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-navy">
          {t('profile.adminNotes')}
        </h2>
        <p className="text-[13px] text-ink-subtle">
          {t('profile.adminNotesHint')}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="admin-note" className="sr-only">
          {t('profile.addNote')}
        </label>
        <Textarea
          id="admin-note"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('profile.notePlaceholder')}
        />
        <FormError
          message={add.isError ? errorMessage(t, add.error) : undefined}
        />
        <Button
          type="submit"
          size="sm"
          className="self-start"
          disabled={!body.trim() || add.isPending}
        >
          {t('profile.addNote')}
        </Button>
      </form>
      <ul className="flex flex-col divide-y divide-divider">
        {notes.data?.map((n) => (
          <NoteItem key={n.id} note={n} queryKey={queryKey} />
        ))}
      </ul>
      {notes.data?.length === 0 && (
        <p className="text-sm text-ink-subtle">{t('profile.noNotes')}</p>
      )}
    </section>
  );
}

function NoteItem({
  note,
  queryKey,
}: {
  note: AdminNoteDto;
  queryKey: string[];
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const save = useMutation({
    mutationFn: () => profilesControllerEditNote(note.id, { body }),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const date = formatDate(new Date(note.createdAt), {
    locale: i18n.language as Language,
    calendar: me.calendar,
    withTime: true,
  });

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-2 text-[13px] text-ink-subtle">
        <span className="flex-1">
          {t('profile.noteBy', {
            name: actedBy(t, note.author, note.impersonator),
            date,
          })}
          {note.updatedAt !== note.createdAt && ` · ${t('profile.edited')}`}
        </span>
        {note.canEdit && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {t('profile.edit')}
          </Button>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) save.mutate();
          }}
          className="flex flex-col gap-2"
        >
          <Textarea
            aria-label={t('profile.edit')}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!body.trim() || save.isPending}
            >
              {t('admin.common.save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setBody(note.body);
              }}
            >
              {t('admin.common.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-line text-[15px] leading-relaxed">
          {note.body}
        </p>
      )}
    </li>
  );
}
