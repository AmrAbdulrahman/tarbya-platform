import { useTranslation } from 'react-i18next';
import type { UpcomingDto } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDayTile, formatTime } from '@tarbya/shared';
import { Badge } from '@tarbya/ui';
import { useMe } from '../../auth/session';

/** Follow-ups and activities that haven't started (design/screens/Main.dc.html, "Upcoming"). */
export function UpcomingList({ items }: { items: UpcomingDto[] }) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const locale = i18n.language as Language;
  if (!items.length) {
    return (
      <p className="text-sm text-ink-subtle">{t('dashboard.noUpcoming')}</p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((u) => {
        const tile = formatDayTile(u.startsAt, {
          locale,
          calendar: me.calendar,
        });
        // A follow-up is named after the other person in it.
        const others = [u.createdBy, ...u.participants].filter(
          (p) => p.id !== me.id,
        );
        const title =
          u.kind === 'FOLLOW_UP'
            ? t('feed.followUpWith', {
                names: others.map((p) => p.name).join('، '),
              })
            : (u.title ?? '');
        const kind =
          u.kind === 'ACTIVITY' && u.activityType
            ? locale === 'ar'
              ? u.activityType.nameAr
              : u.activityType.nameEn
            : t(`feed.kind.${u.kind}`);
        return (
          <li
            key={u.id}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-surface py-1.5">
              <span className="text-[11px] text-ink-subtle">{tile.month}</span>
              <span className="font-figures text-lg font-semibold text-brand">
                {tile.day}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold text-brand">{title}</span>
              <span className="text-[13px] text-ink-subtle">
                <bdi>{formatTime(u.startsAt, { locale })}</bdi> · {kind}
                {u.place && <> · {u.place}</>}
              </span>
            </div>
            {u.createdBy.id === me.id && u.kind === 'ACTIVITY' && (
              <Badge tone="primary">{t('feed.organiser')}</Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
