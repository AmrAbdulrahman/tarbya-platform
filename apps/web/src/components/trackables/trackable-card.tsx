import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TrackableSummaryDto } from '@tarbya/api-client';
import { Badge } from '@tarbya/ui';
import { formatNumber, useCycleLabel, useFormatValue } from './format';
import { Sparkline, TrendBadge } from './trend';

/** design/screens/Mentee.dc.html, plan cards: one per trackable. */
export function TrackableCard({
  trackable: tr,
}: {
  trackable: TrackableSummaryDto;
}) {
  const { t, i18n } = useTranslation();
  const formatValue = useFormatValue();
  const cycleLabel = useCycleLabel();
  const trendLabel = t(`trackables.trend.${tr.trend}`);
  return (
    <Link
      to="/trackables/$id"
      params={{ id: tr.id }}
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 hover:border-primary/50"
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[17px] font-bold text-navy">{tr.name}</span>
          {tr.goal && <span className="text-sm text-ink-muted">{tr.goal}</span>}
        </div>
        {tr.archivedAt ? (
          <Badge>{t('trackables.archived')}</Badge>
        ) : (
          <TrendBadge trend={tr.trend} />
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-figures text-3xl font-semibold text-navy">
          {tr.latest === null ? '—' : formatValue(tr.latest, tr.type)}
        </span>
        {tr.latestCycle && (
          <span className="text-sm text-ink-subtle">
            {cycleLabel(tr.latestCycle, tr.cycle, tr.weekday)}
          </span>
        )}
      </div>
      {tr.points.length > 1 && (
        <Sparkline
          points={tr.points}
          target={tr.target}
          trend={tr.trend}
          label={t('trackables.chart', { trend: trendLabel })}
        />
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-subtle">
        <span>
          {t(`trackables.cycles.${tr.cycle}`)} ·{' '}
          {t(`trackables.types.${tr.type}`)}
        </span>
        {tr.target !== null && (
          <span>
            {t('trackables.of', {
              target: formatNumber(tr.target, i18n.language),
            })}
          </span>
        )}
        <span>
          {t('trackables.stats', { logged: tr.logged, missed: tr.missed })}
        </span>
        {!tr.archivedAt && tr.openCycles.length > 0 && (
          <span className="font-medium text-warn">
            {t('trackables.waiting', { count: tr.openCycles.length })}
          </span>
        )}
      </div>
    </Link>
  );
}
