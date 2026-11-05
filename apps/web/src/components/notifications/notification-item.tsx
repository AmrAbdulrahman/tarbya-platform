import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  Bell,
  CalendarClock,
  ListChecks,
  MessageSquare,
  Mountain,
  TrendingUp,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  notificationsControllerRead,
  type NotificationDto,
  type NotificationType,
  type RsvpResponse,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatTime, toZoned } from '@tarbya/shared';
import { cn } from '@tarbya/ui';
import { useMe } from '../../auth/session';
import { RsvpButtons } from '../groups/rsvp-buttons';
import { useNotificationText } from './text';

const look = (type: NotificationType): { icon: LucideIcon; tone: string } => {
  if (type.startsWith('MENTORSHIP'))
    return { icon: UserRoundPlus, tone: 'bg-primary-tint text-primary-hover' };
  if (type.startsWith('CONTACT'))
    return { icon: CalendarClock, tone: 'bg-red-50 text-trend-down' };
  if (type.startsWith('GATHERING'))
    return { icon: Users, tone: 'bg-sky-50 text-sky-800' };
  if (type.startsWith('CHALLENGE'))
    return { icon: Mountain, tone: 'bg-amber-50 text-warn' };
  if (type === 'TASK_ASSIGNED')
    return { icon: ListChecks, tone: 'bg-emerald-50 text-trend-up' };
  if (type === 'NEW_MESSAGE')
    return { icon: MessageSquare, tone: 'bg-slate-100 text-ink-muted' };
  if (type === 'INTERACTION_SCHEDULED' || type === 'INTERACTION_CHANGED')
    return { icon: Bell, tone: 'bg-primary-tint text-primary-hover' };
  return { icon: TrendingUp, tone: 'bg-amber-50 text-warn' };
};

/** Today's time, else the date. */
function when(
  at: string,
  locale: Language,
  calendar: 'GREGORIAN' | 'HIJRI' | 'BOTH',
) {
  if (toZoned(new Date(at)).date === toZoned(new Date()).date)
    return formatTime(at, { locale });
  return formatDate(at, { locale, calendar, withTime: true });
}

/**
 * One notification: opening it marks it read and goes where it points; an
 * RSVP request can be answered right here (US-7.1).
 */
export function NotificationItem({
  notification: n,
  compact,
  onOpen,
}: {
  notification: NotificationDto;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const text = useNotificationText()(n);
  const { icon: Icon, tone } = look(n.type);
  const [answer, setAnswer] = useState<RsvpResponse | null>(null);
  const unread = !n.readAt;
  const read = useMutation({
    mutationFn: () => notificationsControllerRead(n.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const open = () => {
    if (unread) read.mutate();
    onOpen?.();
    router.history.push(n.link);
  };
  const p = n.payload as Record<string, unknown>;
  const rsvp =
    (n.type === 'GATHERING_RSVP_REQUEST' ||
      (n.type === 'GATHERING_REMINDER' && p['needsRsvp'] === true)) &&
    typeof p['gatheringId'] === 'string' &&
    new Date(String(p['startsAt'])).getTime() > Date.now();

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        unread ? 'bg-primary-tint/30' : 'bg-card',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          tone,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={open}
          className="flex flex-col gap-0.5 text-start"
        >
          <span
            className={cn(
              'text-[15px] text-brand hover:text-primary',
              unread ? 'font-bold' : 'font-medium',
              compact && 'line-clamp-2',
            )}
          >
            {text.title}
          </span>
          {text.body && (
            <span
              className={cn(
                'text-[13px] text-ink-muted',
                compact && 'line-clamp-1',
              )}
            >
              {text.body}
            </span>
          )}
        </button>
        <span className="text-xs text-ink-subtle">
          {when(n.createdAt, locale, me.calendar)}
          {!compact && <> · {t(`notifications.typeName.${n.type}`)}</>}
        </span>
        {rsvp && !compact && (
          <div className="pt-1">
            <RsvpButtons
              gatheringId={String(p['gatheringId'])}
              value={answer}
              onAnswered={(r) => {
                setAnswer(r);
                if (unread) read.mutate();
              }}
            />
          </div>
        )}
      </div>
      {unread && (
        <button
          type="button"
          aria-label={t('notifications.markRead')}
          title={t('notifications.markRead')}
          onClick={() => read.mutate()}
          className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-surface"
        >
          <span className="size-2.5 rounded-full bg-primary" />
        </button>
      )}
    </div>
  );
}
