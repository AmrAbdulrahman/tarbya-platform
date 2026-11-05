import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { GatheringSummaryDto } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDayTile, formatTime } from '@tarbya/shared';
import { useMe } from '../../auth/session';
import { gatheringTitle } from './format';
import { RsvpButtons } from './rsvp-buttons';

/** The member's upcoming gatherings, answered right here (US-5.1, BR-GRP-7). */
export function MyGatherings({ items }: { items: GatheringSummaryDto[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  if (!items.length) {
    return <p className="text-sm text-ink-subtle">{t('groups.noUpcoming')}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((g) => {
        const tile = formatDayTile(g.startsAt, {
          locale,
          calendar: me.calendar,
        });
        return (
          <li
            key={g.id}
            className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-surface py-1.5">
              <span className="text-[11px] text-ink-subtle">{tile.month}</span>
              <span className="font-figures text-lg font-semibold text-brand">
                {tile.day}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Link
                to="/groups/$id"
                params={{ id: g.groupId }}
                search={{ gathering: g.id }}
                className="truncate font-semibold text-brand hover:text-primary"
              >
                {gatheringTitle(g, locale)}
              </Link>
              <span className="text-[13px] text-ink-subtle">
                <bdi>{formatTime(g.startsAt, { locale })}</bdi> · {g.groupName}
                {g.place && <> · {g.place}</>}
              </span>
            </div>
            {g.activityType.requiresRsvp && (
              <RsvpButtons gatheringId={g.id} value={g.myRsvp} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
