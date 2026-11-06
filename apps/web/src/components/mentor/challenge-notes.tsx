import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  challengesControllerList,
  type ChallengeDto,
} from '@tarbya/api-client';
import { withMentionTokens } from '@tarbya/shared';
import { Checkbox } from '@tarbya/ui';
import { challengesQueryKey } from '../mentee/challenges-panel';
import {
  MentionAccessWarning,
  MentionTextarea,
  mentionsIn,
  type Mention,
} from '../mention-textarea';

export interface ChallengeNote {
  comment: string;
  /** People picked while writing the comment. */
  mentions: Mention[];
  resolve: boolean;
}

/** The comment as stored: each `@Name` still in it becomes a mention. */
export const challengeComment = (n: ChallengeNote) =>
  withMentionTokens(n.comment.trim(), mentionsIn(n.comment, n.mentions));

/** BR-CHL-2: a word on each open challenge, or resolving it, as part of the follow-up. */
export function ChallengeNotes({
  menteeId,
  notes,
  onChange,
}: {
  menteeId: string;
  notes: Record<string, ChallengeNote>;
  /** Takes an update, since a pick changes the text and the mentions at once. */
  onChange: (
    update: (
      notes: Record<string, ChallengeNote>,
    ) => Record<string, ChallengeNote>,
  ) => void;
}) {
  const { t } = useTranslation();
  const challenges = useQuery({
    queryKey: challengesQueryKey(menteeId),
    queryFn: async ({ signal }) =>
      (await challengesControllerList({ menteeId }, { signal }))
        .data as ChallengeDto[],
  });
  const open = (challenges.data ?? []).filter((c) => !c.resolvedAt);
  if (!open.length) return null;
  const set = (
    id: string,
    patch: (note: ChallengeNote) => Partial<ChallengeNote>,
  ) =>
    onChange((all) => {
      const note = {
        comment: all[id]?.comment ?? '',
        mentions: all[id]?.mentions ?? [],
        resolve: all[id]?.resolve ?? false,
      };
      return { ...all, [id]: { ...note, ...patch(note) } };
    });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink-muted">
        {t('challenges.openTitle')}
      </span>
      <span className="text-[13px] text-ink-subtle">
        {t('challenges.openHint')}
      </span>
      <ul className="flex flex-col gap-3">
        {open.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
          >
            <span className="font-medium text-brand">{c.title}</span>
            <MentionTextarea
              label={t('challenges.noteOn', { title: c.title })}
              placeholder={t('challenges.commentPlaceholder')}
              rows={1}
              className="min-h-10 py-2"
              maxLength={2000}
              value={notes[c.id]?.comment ?? ''}
              onChange={(comment) => set(c.id, () => ({ comment }))}
              picked={notes[c.id]?.mentions ?? []}
              onPick={(m) =>
                set(c.id, (n) => ({ mentions: [...n.mentions, m] }))
              }
            />
            <MentionAccessWarning
              menteeId={menteeId}
              mentions={mentionsIn(
                notes[c.id]?.comment ?? '',
                notes[c.id]?.mentions ?? [],
              )}
            />
            <Checkbox
              id={`resolve-${c.id}`}
              label={t('challenges.resolve')}
              checked={notes[c.id]?.resolve ?? false}
              onChange={(e) => set(c.id, () => ({ resolve: e.target.checked }))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
