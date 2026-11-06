import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CheckCheck, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  notificationsControllerList,
  notificationsControllerReadAll,
  type NotificationDto,
  type NotificationPageDto,
} from '@tarbya/api-client';
import { addDays, toZoned } from '@tarbya/shared';
import { Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { NotificationItem } from '../../components/notifications/notification-item';
import { useUnreadNotifications } from '../../components/notifications/notifications-menu';
import { PageHeader } from '../../components/page-header';

const FILTERS = ['all', 'unread', 'mentees', 'journey', 'groups'] as const;
type Filter = (typeof FILTERS)[number];

/** US-7.1 · design/screens/Notifications.dc.html */
export const Route = createFileRoute('/_app/notifications')({
  validateSearch: (search: Record<string, unknown>): { filter?: Filter } =>
    FILTERS.includes(search['filter'] as Filter)
      ? { filter: search['filter'] as Filter }
      : {},
  component: NotificationsPage,
});

type Day = 'today' | 'yesterday' | 'week' | 'older';

function dayOf(n: NotificationDto): Day {
  const today = toZoned(new Date()).date;
  const day = toZoned(new Date(n.createdAt)).date;
  if (day === today) return 'today';
  if (day === addDays(today, -1)) return 'yesterday';
  if (day > addDays(today, -7)) return 'week';
  return 'older';
}

function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const filter = Route.useSearch().filter ?? 'all';
  const unread = useUnreadNotifications().data ?? 0;
  const list = useInfiniteQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: async ({ pageParam, signal }) =>
      (
        await notificationsControllerList(
          { filter, before: pageParam ?? undefined },
          { signal },
        )
      ).data as NotificationPageDto,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const readAll = useMutation({
    mutationFn: () => notificationsControllerReadAll(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const days = (['today', 'yesterday', 'week', 'older'] as const)
    .map((day) => ({ day, items: items.filter((n) => dayOf(n) === day) }))
    .filter((g) => g.items.length);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader className="flex-row flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold text-brand">
          {t('notifications.title')}
        </h1>
        <Button
          variant="outline"
          disabled={!unread || readAll.isPending}
          onClick={() => readAll.mutate()}
        >
          <CheckCheck aria-hidden />
          {t('notifications.markAll')}
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/profile" hash="notif">
            <SlidersHorizontal aria-hidden />
            {t('notifications.preferences')}
          </Link>
        </Button>
      </PageHeader>

      <div
        role="tablist"
        aria-label={t('notifications.title')}
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() =>
              navigate({ search: id === 'all' ? {} : { filter: id } })
            }
            className={cn(
              'flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold',
              filter === id
                ? 'border-brand bg-brand text-white'
                : 'border-border bg-card text-ink-muted hover:text-primary',
            )}
          >
            {t(`notifications.filters.${id}`)}
            {id === 'unread' && unread > 0 && (
              <span className="font-figures text-xs opacity-80">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {list.isError && (
        <p className="text-ink-subtle">{errorMessage(t, list.error)}</p>
      )}
      {list.isSuccess && items.length === 0 && (
        <p className="rounded-card border border-border bg-card p-6 text-ink-subtle">
          {t('notifications.empty')}
        </p>
      )}
      {days.map((g) => (
        <section key={g.day} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-subtle">
            {t(`notifications.day.${g.day}`)}
          </h2>
          <ul className="divide-y divide-divider overflow-hidden rounded-card border border-border">
            {g.items.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          {t('notifications.more')}
        </Button>
      )}
    </div>
  );
}
