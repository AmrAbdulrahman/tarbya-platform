import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, SendHorizontal } from 'lucide-react';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  messagesControllerPage,
  messagesControllerRead,
  messagesControllerSend,
  type ConversationDto,
  type MessageDto,
  type MessagePageDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { addDays, formatDate, formatTime, toZoned } from '@tarbya/shared';
import { Button, cn, Textarea } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { FormError } from '../login/fields';
import { Avatar } from '../profile/avatar';
import {
  conversationName,
  conversationRole,
  conversationsQueryKey,
} from './format';

/** One conversation: its messages oldest first, and the composer (US-7.3). */
export function Thread({
  conversation: c,
  onBack,
}: {
  conversation: ConversationDto;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  const queryClient = useQueryClient();
  const queryKey = ['messages', c.id];
  const bottom = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  const messages = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam, signal }) =>
      (
        await messagesControllerPage(
          c.id,
          { before: pageParam ?? undefined },
          { signal },
        )
      ).data as MessagePageDto,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = (messages.data?.pages.flatMap((p) => p.items) ?? [])
    .slice()
    .reverse();
  const latest = items[items.length - 1]?.id;

  // Opening the conversation, or a new message arriving in it, marks it read.
  const read = useMutation({
    mutationFn: () => messagesControllerRead(c.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
  });
  const { mutate: markRead } = read;
  useEffect(() => {
    if (latest && c.unread > 0 && document.visibilityState === 'visible')
      markRead();
  }, [latest, c.unread, markRead]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [latest]);

  const send = useMutation({
    mutationFn: (body: string) => messagesControllerSend(c.id, { body }),
    onSuccess: async () => {
      setDraft('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
      ]);
    },
  });
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (draft.trim() && !send.isPending) send.mutate(draft.trim());
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const today = toZoned(new Date()).date;
  const dayLabel = (day: string, at: string) =>
    day === today
      ? t('messages.today')
      : day === addDays(today, -1)
        ? t('messages.yesterday')
        : formatDate(at, { locale, calendar: me.calendar });
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <section
      aria-label={conversationName(c)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 md:hidden"
          aria-label={t('messages.back')}
          onClick={onBack}
        >
          <Back aria-hidden />
        </Button>
        <Avatar
          name={conversationName(c)}
          url={c.other?.avatarUrl ?? null}
          className="size-10"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-bold text-brand">
            {conversationName(c)}
          </h2>
          <span className="text-[13px] text-ink-subtle">
            {conversationRole(t, c)}
          </span>
        </div>
        <ProfileLink conversation={c} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-surface/60 px-4 py-4">
        {messages.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            disabled={messages.isFetchingNextPage}
            onClick={() => messages.fetchNextPage()}
          >
            {t('messages.older')}
          </Button>
        )}
        {messages.isSuccess && items.length === 0 && (
          <p className="m-auto text-sm text-ink-subtle">
            {t('messages.empty')}
          </p>
        )}
        {items.map((m, i) => {
          const day = toZoned(new Date(m.createdAt)).date;
          const newDay =
            i === 0 || toZoned(new Date(items[i - 1].createdAt)).date !== day;
          return (
            <Fragment key={m.id}>
              {newDay && (
                <span className="self-center rounded-full bg-card px-3 py-1 text-xs text-ink-subtle">
                  {dayLabel(day, m.createdAt)}
                </span>
              )}
              <Bubble
                message={m}
                mine={m.author.id === me.id}
                showAuthor={c.kind === 'GROUP'}
              />
            </Fragment>
          );
        })}
        <div ref={bottom} />
      </div>

      {c.canPost ? (
        <form
          onSubmit={submit}
          className="flex items-end gap-2 border-t border-border p-3"
        >
          <Textarea
            aria-label={t('messages.write')}
            placeholder={t('messages.write')}
            className="max-h-40 min-h-11 flex-1 resize-none py-2.5"
            rows={1}
            maxLength={4000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t('messages.send')}
            disabled={!draft.trim() || send.isPending}
          >
            <SendHorizontal className="rtl:-scale-x-100" aria-hidden />
          </Button>
        </form>
      ) : (
        <p className="border-t border-border p-4 text-sm text-ink-subtle">
          {t('messages.closed')}
        </p>
      )}
      <div className="px-3 pb-2 empty:hidden">
        <FormError
          message={send.isError ? errorMessage(t, send.error) : undefined}
        />
      </div>
      {messages.isError && (
        <p className="p-4 text-sm text-ink-subtle">
          {errorMessage(t, messages.error)}
        </p>
      )}
    </section>
  );
}

function Bubble({
  message: m,
  mine,
  showAuthor,
}: {
  message: MessageDto;
  mine: boolean;
  showAuthor: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  return (
    <div
      className={cn(
        'flex max-w-[78%] flex-col gap-1 rounded-2xl px-3.5 py-2',
        mine
          ? 'self-start rounded-ss-sm bg-primary text-primary-foreground'
          : 'self-end rounded-se-sm border border-border bg-card text-ink',
      )}
    >
      {showAuthor && !mine && (
        <span className="text-xs font-semibold text-primary">
          {actedBy(t, m.author, m.impersonator)}
        </span>
      )}
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {m.body}
      </p>
      <span
        className={cn(
          'text-[11px]',
          mine ? 'text-primary-foreground/75' : 'text-ink-subtle',
        )}
      >
        <bdi>{formatTime(m.createdAt, { locale })}</bdi>
        {m.impersonator && mine && (
          <> · {actedBy(t, m.author, m.impersonator)}</>
        )}
      </span>
    </div>
  );
}

function ProfileLink({ conversation: c }: { conversation: ConversationDto }) {
  const { t } = useTranslation();
  const className = 'text-sm font-semibold text-primary hover:underline';
  if (c.group)
    return (
      <Link to="/groups/$id" params={{ id: c.group.id }} className={className}>
        {t('messages.profile.group')}
      </Link>
    );
  if (c.other && c.relation === 'MY_MENTEE')
    return (
      <Link to="/people/$id" params={{ id: c.other.id }} className={className}>
        {t('messages.profile.mentee')}
      </Link>
    );
  if (c.relation === 'MY_MENTOR')
    return (
      <Link to="/my" className={className}>
        {t('messages.profile.mentor')}
      </Link>
    );
  return null;
}
