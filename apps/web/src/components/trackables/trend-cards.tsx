import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Activity } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerList,
  type TrackableSummaryDto,
} from '@tarbya/api-client';
import { useCycleLabel, useFormatValue } from './format';
import { trackablesQueryKey } from './trackables-board';
import { Sparkline, TrendBadge } from './trend';

/** A mentee's active trackables. */
export function useActiveTrackables(menteeId: string) {
  const trackables = useQuery({
    queryKey: trackablesQueryKey(menteeId),
    queryFn: async ({ signal }) =>
      (await trackablesControllerList({ menteeId }, { signal }))
        .data as TrackableSummaryDto[],
  });
  return {
    ...trackables,
    active: (trackables.data ?? []).filter((x) => !x.archivedAt),
  };
}

/**
 * One trackable at a glance: its trend, latest value and sparkline (BR-TRK-5).
 * `children` sits at the bottom, e.g. a follow-up's value for this cycle.
 */
export function TrendCard({
  trackable: tr,
  link = true,
  children,
}: {
  trackable: TrackableSummaryDto;
  /** Off inside a dialog, where leaving the page would lose the form. */
  link?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const formatValue = useFormatValue();
  const cycleLabel = useCycleLabel();
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        {link ? (
          <Link
            to="/trackables/$id"
            params={{ id: tr.id }}
            className="min-w-0 flex-1 truncate text-sm font-bold text-brand hover:text-primary"
          >
            {tr.name}
          </Link>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-brand">
            {tr.name}
          </span>
        )}
        <TrendBadge trend={tr.trend} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-figures text-xl font-semibold text-brand">
          {tr.latest === null ? '—' : formatValue(tr.latest, tr.type)}
        </span>
        <span className="truncate text-[12px] text-ink-subtle">
          {tr.latestCycle
            ? cycleLabel(tr.latestCycle, tr.cycle, tr.weekday)
            : t('dashboard.noReadings')}
        </span>
      </div>
      {tr.points.length > 1 && (
        <Sparkline
          points={tr.points}
          target={tr.target}
          trend={tr.trend}
          height={36}
          label={t('trackables.chart', {
            trend: t(`trackables.trend.${tr.trend}`),
          })}
        />
      )}
      {children}
    </li>
  );
}

/** The mentee's trends side by side (US-4.2). */
export function TrendCards({ menteeId }: { menteeId: string }) {
  const { t } = useTranslation();
  const { active } = useActiveTrackables(menteeId);
  if (!active.length) return null;
  return (
    <section
      aria-labelledby="trends-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <h2
        id="trends-title"
        className="flex items-center gap-2 text-base font-bold text-brand"
      >
        <Activity className="size-5 text-primary" aria-hidden />
        {t('trackables.trends')}
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
        {active.map((x) => (
          <TrendCard key={x.id} trackable={x} />
        ))}
      </ul>
    </section>
  );
}
