import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { PlanSummaryDto } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { Badge } from '@tarbya/ui';
import { useMe } from '../../auth/session';
import { Sparkline, TrendBadge } from './trend';

export function formatNumber(n: number, lang: string) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    maximumFractionDigits: 2,
  }).format(n);
}

/** design/screens/Mentee.dc.html, plan cards */
export function PlanCard({ plan }: { plan: PlanSummaryDto }) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const tracking =
    i18n.language === 'ar'
      ? plan.trackingMethod.nameAr
      : plan.trackingMethod.nameEn;
  const trendLabel = t(`plans.trend.${plan.trend}`);
  return (
    <Link
      to="/plans/$id"
      params={{ id: plan.id }}
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-5 hover:border-primary/50"
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[17px] font-bold text-navy">{plan.name}</span>
          <span className="text-sm text-ink-muted">{plan.goal}</span>
        </div>
        {plan.closedAt ? (
          <Badge>{t('plans.closed')}</Badge>
        ) : (
          <TrendBadge trend={plan.trend} />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-figures text-3xl font-semibold text-navy">
          {plan.latest === null
            ? '—'
            : formatNumber(plan.latest, i18n.language)}
        </span>
        <span className="text-sm text-ink-subtle">
          {t('plans.of', { target: formatNumber(plan.target, i18n.language) })}
        </span>
      </div>
      {plan.points.length > 1 && (
        <Sparkline
          points={plan.points}
          target={plan.target}
          trend={plan.trend}
          label={t('plans.chart', { trend: trendLabel })}
        />
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-subtle">
        <span>{tracking}</span>
        {plan.endsOn && (
          <span>
            {t('plans.ends')}{' '}
            {formatDate(new Date(`${plan.endsOn}T12:00:00Z`), {
              locale: i18n.language as Language,
              calendar: me.calendar,
            })}
          </span>
        )}
        {plan.trend !== 'NEW' && (
          <span>
            {t('plans.change', {
              sign: plan.change > 0 ? '+' : plan.change < 0 ? '−' : '±',
              value: formatNumber(Math.abs(plan.change), i18n.language),
            })}
          </span>
        )}
      </div>
    </Link>
  );
}
