import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  notificationsControllerList,
  notificationsControllerReadAll,
  notificationsControllerUnreadCount,
  type NotificationPageDto,
} from '@tarbya/api-client';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tarbya/ui';
import { NotificationItem } from './notification-item';

/** The unread count for the bell; refetched on live events (BR-NTF-2). */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async ({ signal }) =>
      (await notificationsControllerUnreadCount({ signal })).data.count,
  });
}

/** The header bell: unread badge and the latest items (US-7.1, design/screens/Main.dc.html). */
export function NotificationsMenu() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const unread = useUnreadNotifications().data ?? 0;
  const latest = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: async ({ signal }) =>
      (await notificationsControllerList({ limit: 6 }, { signal }))
        .data as NotificationPageDto,
    enabled: open,
  });
  const readAll = useMutation({
    mutationFn: () => notificationsControllerReadAll(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t('header.notifications')}${unread ? ` · ${t('notifications.unreadCount', { count: unread })}` : ''}`}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute end-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-trend-down px-1 font-figures text-[11px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 p-0">
        <DropdownMenuLabel className="flex items-center gap-3 px-4 py-3">
          <span className="flex-1 font-bold text-brand">
            {t('notifications.title')}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => readAll.mutate()}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {t('notifications.markAll')}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[60vh] divide-y divide-divider overflow-y-auto">
          {latest.data?.items.length === 0 && (
            <p className="px-4 py-6 text-sm text-ink-subtle">
              {t('notifications.empty')}
            </p>
          )}
          {latest.data?.items.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              compact
              onOpen={() => setOpen(false)}
            />
          ))}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="block px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-surface"
        >
          {t('notifications.all')}
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
