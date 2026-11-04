import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  notesControllerCreate,
  notesControllerList,
  notesControllerUpdate,
  type NoteDto,
  type NoteVisibility,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  Select,
  Textarea,
} from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { FormError } from '../login/fields';

/**
 * Shared and private notes on a mentee (US-4.6, US-5.3). The API returns only
 * what the viewer may read; only the current mentor writes.
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
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>('PRIVATE');
  const add = useMutation({
    mutationFn: () =>
      notesControllerCreate({ menteeId: mentee.id, visibility, body }),
    onSuccess: async () => {
      setBody('');
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) add.mutate();
  };

  return (
    <section
      aria-labelledby="notes-title"
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <h2 id="notes-title" className="text-base font-bold text-brand">
        {t('mentee.notes')}
      </h2>
      {canWrite && (
        <form onSubmit={onAdd} className="flex flex-col gap-2">
          <Textarea
            aria-label={t('mentee.newNote')}
            placeholder={t('profile.notePlaceholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <VisibilitySelect
              id="note-visibility"
              value={visibility}
              onChange={setVisibility}
            />
            <Button
              type="submit"
              size="sm"
              disabled={add.isPending || !body.trim()}
            >
              {t('mentee.addNote')}
            </Button>
          </div>
          <FormError
            message={add.isError ? errorMessage(t, add.error) : undefined}
          />
        </form>
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
            menteeName={mentee.name}
            onSaved={() => queryClient.invalidateQueries({ queryKey })}
          />
        ))}
      </ul>
    </section>
  );
}

function VisibilitySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: NoteVisibility;
  onChange: (v: NoteVisibility) => void;
}) {
  const { t } = useTranslation();
  return (
    <Select
      id={id}
      aria-label={t('mentee.visibility')}
      value={value}
      onChange={(e) => onChange(e.target.value as NoteVisibility)}
      className="h-9 w-auto text-sm"
    >
      <option value="PRIVATE">{t('mentee.privateOption')}</option>
      <option value="SHARED">{t('mentee.sharedOption')}</option>
    </Select>
  );
}

function NoteItem({
  note,
  menteeName,
  onSaved,
}: {
  note: NoteDto;
  menteeName: string;
  onSaved: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [visibility, setVisibility] = useState(note.visibility);
  const [confirming, setConfirming] = useState(false);
  const save = useMutation({
    mutationFn: (confirmWiden: boolean) =>
      notesControllerUpdate(note.id, { body, visibility, confirmWiden }),
    onSuccess: async () => {
      setConfirming(false);
      setEditing(false);
      await onSaved();
    },
    onError: (error) => {
      // US-4.6: widening a private note to shared asks first.
      if (error instanceof ApiError && error.code === 'NOTE_WIDEN_CONFIRM') {
        setConfirming(true);
      }
    },
  });
  const shared = note.visibility === 'SHARED';

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-4">
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
            if (body.trim()) save.mutate(false);
          }}
        >
          <Textarea
            aria-label={t('mentee.noteBody')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <VisibilitySelect
              id={`note-${note.id}-visibility`}
              value={visibility}
              onChange={setVisibility}
            />
            <Button
              type="submit"
              size="sm"
              disabled={save.isPending || !body.trim()}
            >
              {t('mentee.save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setBody(note.body);
                setVisibility(note.visibility);
              }}
            >
              {t('mentee.cancel')}
            </Button>
          </div>
          <FormError
            message={
              save.isError && !confirming
                ? errorMessage(t, save.error)
                : undefined
            }
          />
        </form>
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {note.body}
        </p>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={t('mentee.widenTitle')}
          closeLabel={t('admin.common.close')}
        >
          <p className="text-[15px] leading-relaxed">
            {t('mentee.widenAsk', { name: menteeName })}
          </p>
          <div className="flex gap-2">
            <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
              {t('mentee.widen')}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('mentee.cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
