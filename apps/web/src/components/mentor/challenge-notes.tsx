import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  challengesControllerList,
  type ChallengeDto,
} from '@tarbya/api-client';
import { Checkbox, Input } from '@tarbya/ui';
import { challengesQueryKey } from '../mentee/challenges-panel';

export interface ChallengeNote {
  comment: string;
  resolve: boolean;
}

/** BR-CHL-2: a word on each open challenge, or resolving it, as part of the follow-up. */
export function ChallengeNotes({
  menteeId,
  notes,
  onChange,
}: {
  menteeId: string;
  notes: Record<string, ChallengeNote>;
  onChange: (notes: Record<string, ChallengeNote>) => void;
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
  const set = (id: string, patch: Partial<ChallengeNote>) =>
    onChange({
      ...notes,
      [id]: {
        comment: notes[id]?.comment ?? '',
        resolve: notes[id]?.resolve ?? false,
        ...patch,
      },
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
            <span className="font-medium text-navy">{c.title}</span>
            <Input
              aria-label={t('challenges.noteOn', { title: c.title })}
              placeholder={t('challenges.commentPlaceholder')}
              className="h-10 text-[15px]"
              value={notes[c.id]?.comment ?? ''}
              onChange={(e) => set(c.id, { comment: e.target.value })}
            />
            <Checkbox
              id={`resolve-${c.id}`}
              label={t('challenges.resolve')}
              checked={notes[c.id]?.resolve ?? false}
              onChange={(e) => set(c.id, { resolve: e.target.checked })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
