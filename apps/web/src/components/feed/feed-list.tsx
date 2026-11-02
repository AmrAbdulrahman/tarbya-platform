import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  CalendarCheck,
  MessageSquareReply,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  feedControllerList,
  type FeedItemDto,
  type FeedKind,
  type FeedPageDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { formatNumber } from '../plans/plan-card';

const kinds: Record<FeedKind, { icon: LucideIcon; className: string }> = {
  FOLLOW_UP: {
    icon: CalendarCheck,
    className: 'bg-primary-tint text-primary-hover',
  },
  ACTIVITY: { icon: Sparkles, className: 'bg-emerald-50 text-trend-up' },
  CHECK_IN: { icon: TrendingUp, className: 'bg-amber-50 text-warn' },
  REPLY: {
    icon: MessageSquareReply,
    className: 'bg-manager-tint text-manager',
  },
};

export const feedQueryKey = (userId: string) => ['feed', userId];

/** A member's history, newest first (US-4.2 timeline, US-5.1 feed). */
export function FeedList({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const feed = useInfiniteQuery({
    queryKey: feedQueryKey(userId),
    queryFn: async ({ pageParam, signal }) =>
      (
        await feedControllerList(
          { userId, before: pageParam, limit: 10 },
          { signal },
        )
      ).data as FeedPageDto,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  if (feed.isError) {
    return (
      <p className="text-sm text-ink-subtle">{errorMessage(t, feed.error)}</p>
    );
  }
  if (feed.isSuccess && !items.length) {
    return <p className="text-sm text-ink-subtle">{t('feed.empty')}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col">
        {items.map((item, i) => (
          <FeedEntry key={item.key} item={item} last={i === items.length - 1} />
        ))}
      </ol>
      {feed.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={feed.isFetchingNextPage}
          onClick={() => feed.fetchNextPage()}
        >
          {t('feed.more')}
        </Button>
      )}
    </div>
  );
}

function FeedEntry({ item, last }: { item: FeedItemDto; last: boolean }) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const locale = i18n.language as Language;
  const { icon: Icon, className } = kinds[item.kind];

  let title: string;
  let body: string | null = null;
  let kind = t(`feed.kind.${item.kind}`);
  switch (item.kind) {
    case 'FOLLOW_UP':
      title = t('feed.followUp');
      body = [
        t('feed.planUpdates', { count: item.planUpdates }),
        t('feed.challenges', { count: item.challenges }),
        t('feed.tasks', { count: item.tasks }),
      ].join(' · ');
      break;
    case 'ACTIVITY':
      title = item.title ?? '';
      if (item.activityType) {
        kind = `${kind} · ${locale === 'ar' ? item.activityType.nameAr : item.activityType.nameEn}`;
      }
      body = t('feed.participants', { count: item.participants });
      break;
    case 'CHECK_IN':
      title = t('feed.checkIn', {
        plan: item.plan?.name,
        value: formatNumber(item.value ?? 0, i18n.language),
      });
      body = item.text;
      break;
    case 'REPLY':
      title = t('feed.reply', {
        name: actedBy(t, item.actor, item.impersonator),
        plan: item.plan?.name,
      });
      body = item.text;
      break;
  }

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full',
            className,
          )}
        >
          <Icon className="size-4" />
        </span>
        {!last && <span className="w-px flex-1 bg-border" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pb-5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {item.plan ? (
            <Link
              to="/plans/$id"
              params={{ id: item.plan.id }}
              className="font-semibold text-navy hover:text-primary"
            >
              {title}
            </Link>
          ) : (
            <span className="font-semibold text-navy">{title}</span>
          )}
          <span className="text-[13px] text-ink-subtle">{kind}</span>
        </div>
        <span className="text-[13px] text-ink-subtle">
          {formatDate(item.at, {
            locale,
            calendar: me.calendar,
            withTime: true,
          })}
          {item.kind !== 'REPLY' &&
            (item.actor.id !== me.id || item.impersonator) && (
              <>
                {' · '}
                {t('feed.by', {
                  name: actedBy(t, item.actor, item.impersonator),
                })}
              </>
            )}
        </span>
        {body && (
          <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
        )}
      </div>
    </li>
  );
}
