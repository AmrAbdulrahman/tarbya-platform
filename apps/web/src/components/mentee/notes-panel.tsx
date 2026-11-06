import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  notesControllerCreate,
  notesControllerList,
  notesControllerUpdate,
  type NoteDto,
  type NoteVisibility,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { Badge, Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { FormError } from '../login/fields';
import {
  MentionAccessWarning,
  MentionText,
  MentionTextarea,
  useMentionDraft,
} from '../mention-textarea';

/**
 * Shared and private notes on a member (US-4.6, US-5.3, BR-NOTE-1, BR-NOTE-3).
 * The API returns only what the viewer may read; those above the member write.
 */
export function NotesPanel({
  mentee,
  canWrite,
}: {
  mentee: { id: string; name: string };
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['notes', mentee.id];
  const notes = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await notesControllerList({ menteeId: mentee.id }, { signal }))
        .data as NoteDto[],
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  return (
    <section
      aria-labelledby="notes-title"
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <h2 id="notes-title" className="text-base font-bold text-brand">
        {t('mentee.notes')}
      </h2>
      {canWrite && (
        <div className="flex flex-col gap-3">
          <NoteComposer
            menteeId={mentee.id}
            visibility="SHARED"
            hint={t('mentee.sharedHint', { name: mentee.name })}
            onAdded={refresh}
          />
          <NoteComposer
            menteeId={mentee.id}
            visibility="PRIVATE"
            hint={t('mentee.privateHint', { name: mentee.name })}
            onAdded={refresh}
          />
        </div>
      )}
      {notes.isError && (
        <p className="text-sm text-ink-subtle">
          {errorMessage(t, notes.error)}
        </p>
      )}
      {notes.data?.length === 0 && (
        <p className="text-sm text-ink-subtle">{t('profile.noNotes')}</p>
      )}
      <ul className="flex flex-col gap-3">
        {notes.data?.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            menteeId={mentee.id}
            menteeName={mentee.name}
            onSaved={() => queryClient.invalidateQueries({ queryKey })}
          />
        ))}
      </ul>
    </section>
  );
}

/** One box per kind of note, so a private note is never shared by a slip. */
function NoteComposer({
  menteeId,
  visibility,
  hint,
  onAdded,
}: {
  menteeId: string;
  visibility: NoteVisibility;
  hint: string;
  onAdded: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const draft = useMentionDraft();
  const shared = visibility === 'SHARED';
  const add = useMutation({
    mutationFn: () =>
      notesControllerCreate({ menteeId, visibility, body: draft.body() }),
    onSuccess: async () => {
      draft.reset();
      await onAdded();
    },
  });
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (draft.text.trim()) add.mutate();
  };
  const title = shared ? t('mentee.sharedNote') : t('mentee.privateNote');
  return (
    <form
      onSubmit={onAdd}
      aria-label={title}
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-3',
        shared
          ? 'border-border bg-surface/60'
          : 'border-accent border-s-4 border-s-warn bg-accent-tint/60',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-sm font-semibold',
          shared ? 'text-primary-hover' : 'text-warn',
        )}
      >
        {shared ? (
          <Users className="size-4" aria-hidden />
        ) : (
          <Lock className="size-4" aria-hidden />
        )}
        {title}
      </span>
      <MentionTextarea
        label={title}
        placeholder={t('profile.notePlaceholder')}
        className="min-h-16 bg-card"
        value={draft.text}
        onChange={draft.setText}
        picked={draft.picked}
        onPick={draft.pick}
        maxLength={5000}
        rows={2}
      />
      <MentionAccessWarning
        menteeId={menteeId}
        mentions={draft.mentioned}
        noteVisibility={visibility}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-[13px] text-ink-subtle">{hint}</span>
        <Button
          type="submit"
          size="sm"
          variant={shared ? 'primary' : 'outline'}
          disabled={add.isPending || !draft.text.trim()}
        >
          {t('mentee.addNote')}
        </Button>
      </div>
      <FormError
        message={add.isError ? errorMessage(t, add.error) : undefined}
      />
    </form>
  );
}

function NoteItem({
  note,
  menteeId,
  menteeName,
  onSaved,
}: {
  note: NoteDto;
  menteeId: string;
  menteeName: string;
  onSaved: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const [editing, setEditing] = useState(false);
  const draft = useMentionDraft(note.body);
  // A note keeps the visibility it was written with.
  const save = useMutation({
    mutationFn: () => notesControllerUpdate(note.id, { body: draft.body() }),
    onSuccess: async () => {
      setEditing(false);
      await onSaved();
    },
  });
  const shared = note.visibility === 'SHARED';

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-4',
        shared
          ? 'border-border'
          : 'border-accent border-s-4 border-s-warn bg-accent-tint/60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={shared ? 'success' : 'warn'} className="gap-1.5">
          {shared ? (
            <Users className="size-3.5" aria-hidden />
          ) : (
            <Lock className="size-3.5" aria-hidden />
          )}
          {shared
            ? t('mentee.shared', { name: menteeName })
            : t('mentee.private')}
        </Badge>
        <span className="flex-1 text-[13px] text-ink-subtle">
          {t('profile.noteBy', {
            name: actedBy(t, note.author, note.impersonator),
            date: formatDate(note.createdAt, {
              locale: i18n.language as Language,
              calendar: me.calendar,
            }),
          })}
        </span>
        {note.author.id === me.id && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {t('profile.edit')}
          </Button>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.text.trim()) save.mutate();
          }}
        >
          <MentionTextarea
            label={t('mentee.noteBody')}
            value={draft.text}
            onChange={draft.setText}
            picked={draft.picked}
            onPick={draft.pick}
            maxLength={5000}
            rows={3}
          />
          <MentionAccessWarning
            menteeId={menteeId}
            mentions={draft.mentioned}
            noteVisibility={note.visibility}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={save.isPending || !draft.text.trim()}
            >
              {t('mentee.save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                draft.reset(note.body);
              }}
            >
              {t('mentee.cancel')}
            </Button>
          </div>
          <FormError
            message={save.isError ? errorMessage(t, save.error) : undefined}
          />
        </form>
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
          <MentionText body={note.body} />
        </p>
      )}
    </li>
  );
}
