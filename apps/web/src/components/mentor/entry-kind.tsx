import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@tarbya/ui';

/** Follow-up or activity: the two entry types switch between their forms (FollowUp.dc.html). */
export function EntryKind({
  current,
  menteeId,
}: {
  current: 'follow-up' | 'activity';
  /** Kept when switching, so the chosen mentee stays. */
  menteeId?: string;
}) {
  const { t } = useTranslation();
  const tiles = [
    {
      id: 'follow-up',
      to: '/mentor/log',
      label: t('mentoring.log.followUp'),
      hint: t('mentoring.log.followUpHint'),
    },
    {
      id: 'activity',
      to: '/mentor/activity',
      label: t('mentoring.log.activity'),
      hint: t('mentoring.log.activityHint'),
    },
  ] as const;
  return (
    <nav
      aria-label={t('mentoring.log.kind')}
      className="grid gap-3 sm:grid-cols-2"
    >
      {tiles.map((tile) => (
        <Link
          key={tile.id}
          to={tile.to}
          search={{ menteeId }}
          aria-current={tile.id === current ? 'page' : undefined}
          className={cn(
            'flex flex-col gap-1 rounded-card border-2 px-4 py-3',
            tile.id === current
              ? 'border-primary bg-primary-tint/60'
              : 'border-border bg-card hover:border-primary/50',
          )}
        >
          <span className="font-semibold text-navy">{tile.label}</span>
          <span className="text-[13px] text-ink-subtle">{tile.hint}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Upcoming or done, worked out from the date and time as they're typed (BR-FU-3). */
export function WhenStatus({ upcoming }: { upcoming: boolean }) {
  const { t } = useTranslation();
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
      <span
        className={cn(
          'inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-medium',
          upcoming
            ? 'bg-manager-tint text-manager'
            : 'bg-emerald-50 text-trend-up',
        )}
      >
        {upcoming ? t('mentoring.log.upcoming') : t('mentoring.log.done')}
      </span>
      {upcoming ? t('mentoring.log.upcomingHint') : t('mentoring.log.doneHint')}
    </p>
  );
}
