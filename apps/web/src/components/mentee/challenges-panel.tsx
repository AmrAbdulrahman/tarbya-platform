import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleCheck,
  MessageSquare,
  Mountain,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  challengesControllerComment,
  challengesControllerCreate,
  challengesControllerList,
  challengesControllerUpdate,
  type ChallengeDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, withMentionTokens } from '@tarbya/shared';
import { Badge, Button, cn, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { FormError } from '../login/fields';
import {
  MentionAccessWarning,
  MentionText,
  MentionTextarea,
  mentionsIn,
  type Mention,
} from '../mention-textarea';

export const challengesQueryKey = (menteeId: string) => [
  'challenges',
  menteeId,
];

/**
 * A mentee's challenges (BR-CHL-1…3): open ones first, each with its comments.
 * The mentor and admins add, resolve and reopen; the mentee comments too.
 */
export function ChallengesPanel({
  menteeId,
  canManage,
}: {
  menteeId: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = challengesQueryKey(menteeId);
  const challenges = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await challengesControllerList({ menteeId }, { signal }))
        .data as ChallengeDto[],
  });
  const refresh = () =>
    Promise.all(
      [queryKey, ['dashboard'], ['feed', menteeId]].map((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      ),
    );
  const [title, setTitle] = useState('');
  const add = useMutation({
    mutationFn: () => challengesControllerCreate({ menteeId, title }),
    onSuccess: async () => {
      setTitle('');
      await refresh();
    },
  });
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) add.mutate();
  };

  return (
    <section
      aria-labelledby="challenges-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-card p-4"
    >
      <h2
        id="challenges-title"
        className="flex items-center gap-2 text-base font-bold text-brand"
      >
        <Mountain className="size-4 text-warn" aria-hidden />
        {t('challenges.title')}
      </h2>
      {canManage && (
        <form onSubmit={onAdd} className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Input
              aria-label={t('challenges.newChallenge')}
              placeholder={t('challenges.placeholder')}
              className="h-9 flex-1 text-[15px]"
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              className="h-9"
              disabled={add.isPending || !title.trim()}
            >
              {t('challenges.add')}
            </Button>
          </div>
          <FormError
            message={add.isError ? errorMessage(t, add.error) : undefined}
          />
        </form>
      )}
      {challenges.isError && (
        <p className="text-sm text-ink-subtle">
          {errorMessage(t, challenges.error)}
        </p>
      )}
      {challenges.data?.length === 0 && (
        <p className="text-sm text-ink-subtle">{t('challenges.none')}</p>
      )}
      <ul className="flex flex-col divide-y divide-border">
        {challenges.data?.map((c) => (
          <ChallengeItem
            key={c.id}
            challenge={c}
            canManage={canManage}
            onChanged={refresh}
          />
        ))}
      </ul>
    </section>
  );
}

function ChallengeItem({
  challenge: c,
  canManage,
  onChanged,
}: {
  challenge: ChallengeDto;
  canManage: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const threadId = useId();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<Mention[]>([]);
  const mentioned = mentionsIn(body, picked);
  const resolved = !!c.resolvedAt;
  const date = (iso: string) =>
    formatDate(iso, {
      locale: i18n.language as Language,
      calendar: me.calendar,
    });
  const toggle = useMutation({
    mutationFn: () => challengesControllerUpdate(c.id, { resolved: !resolved }),
    onSuccess: onChanged,
  });
  const comment = useMutation({
    mutationFn: () =>
      challengesControllerComment(c.id, {
        body: withMentionTokens(body, mentioned),
      }),
    onSuccess: async () => {
      setBody('');
      setPicked([]);
      await onChanged();
    },
  });

  return (
    <li className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        {resolved ? (
          <CircleCheck
            className="mt-0.5 size-4 shrink-0 text-trend-up"
            aria-hidden
          />
        ) : (
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-warn"
            aria-hidden
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              'text-[15px] font-semibold text-brand',
              resolved && 'text-ink-subtle line-through decoration-2',
            )}
          >
            {c.title}
          </span>
          <span className="text-[13px] text-ink-subtle">
            {t('challenges.raisedBy', {
              name: actedBy(t, c.createdBy, c.impersonator),
              date: date(c.createdAt),
            })}
            {c.interactionId && <> · {t('challenges.inFollowUp')}</>}
          </span>
          {resolved && c.resolvedAt && (
            <span className="text-[13px] text-trend-up">
              {t('challenges.resolvedBy', {
                name: c.resolvedBy?.name ?? '',
                date: date(c.resolvedAt),
              })}
            </span>
          )}
        </div>
        {resolved && <Badge tone="success">{t('challenges.resolved')}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-1 ps-6">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls={threadId}
          onClick={() => setOpen((o) => !o)}
        >
          <MessageSquare aria-hidden />
          {t('challenges.comments', { count: c.comments.length })}
        </Button>
        {canManage && (
          <Button
            size="sm"
            variant="ghost"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {resolved ? <RotateCcw aria-hidden /> : <CircleCheck aria-hidden />}
            {resolved ? t('challenges.reopen') : t('challenges.resolve')}
          </Button>
        )}
      </div>
      {open && (
        <div id={threadId} className="flex flex-col gap-2 ps-6">
          {c.comments.map((x) => (
            <div
              key={x.id}
              className="rounded-lg border-s-4 border-warn/40 bg-amber-50/60 px-3 py-2"
            >
              <p className="text-[13px] text-ink-subtle">
                {actedBy(t, x.author, x.impersonator)} · {date(x.createdAt)}
                {x.interactionId && <> · {t('challenges.inFollowUp')}</>}
              </p>
              <p className="whitespace-pre-line text-[15px]">
                <MentionText body={x.body} />
              </p>
            </div>
          ))}
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) comment.mutate();
            }}
          >
            <MentionTextarea
              label={t('challenges.comment')}
              placeholder={t('challenges.commentPlaceholder')}
              maxLength={2000}
              value={body}
              onChange={setBody}
              picked={picked}
              onPick={(m) => setPicked((list) => [...list, m])}
            />
            <MentionAccessWarning menteeId={c.menteeId} mentions={mentioned} />
            <FormError
              message={
                comment.isError ? errorMessage(t, comment.error) : undefined
              }
            />
            <Button
              type="submit"
              size="sm"
              className="self-start"
              disabled={!body.trim() || comment.isPending}
            >
              {t('challenges.send')}
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}
