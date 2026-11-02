import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
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
import { formatDate } from '@tarbya/shared';
import { Badge, Button, Textarea } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { FormError } from '../../../components/login/fields';
import { PlansSection } from '../../../components/plans/plans-section';
import { RoleChips } from '../../../components/role-chips';

/** A member's profile; step 6 grows it into the full mentee profile (US-4.2). */
export const Route = createFileRoute('/_app/people/$id')({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
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
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="grid size-14 place-items-center rounded-full bg-primary-tint text-2xl font-bold text-primary-hover"
        >
          {p.name.charAt(0)}
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold text-navy">{p.name}</h1>
          <div
            className="flex flex-wrap gap-1.5"
            aria-label={t('profile.roles')}
          >
            <RoleChips roles={p.roles} />
            {p.deactivatedAt && (
              <Badge tone="danger">{t('profile.deactivated')}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex flex-[1_1_300px] flex-col gap-4 rounded-card border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-navy">
            {t('profile.contact')}
          </h2>
          <dl className="flex flex-col gap-3 text-[15px]">
            <Detail label={t('profile.email')}>
              {p.email ? <bdi>{p.email}</bdi> : t('profile.none')}
            </Detail>
            <Detail label={t('profile.phone')}>
              {p.phone ? <bdi>{p.phone}</bdi> : t('profile.none')}
            </Detail>
            <Detail label={t('profile.manager')}>
              <PersonLink user={p.manager} />
            </Detail>
            <Detail label={t('profile.mentor')}>
              <PersonLink user={p.mentor} />
            </Detail>
          </dl>
        </section>
        {p.canSeeAdminNotes && <AdminNotes subjectId={p.id} />}
      </div>
      {p.canSeePlans && (
        <PlansSection menteeId={p.id} canManage={p.canManagePlans} />
      )}
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="font-medium">{children}</dd>
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
    <section className="flex flex-[2_1_420px] flex-col gap-4 rounded-card border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-navy">
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
          rows={3}
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
          {t('profile.noteBy', { name: note.author.name, date })}
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
