import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { plansControllerList, type PlanSummaryDto } from '@tarbya/api-client';
import { cn, Input } from '@tarbya/ui';
import { formatNumber } from '../plans/plan-card';
import { Card } from './form-parts';

/** BR-PLAN-3: a reading per open plan, recorded with the follow-up (FollowUp.dc.html). */
export function PlanUpdates({
  menteeId,
  values,
  onChange,
  upcoming,
}: {
  menteeId: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  upcoming: boolean;
}) {
  const { t, i18n } = useTranslation();
  const plans = useQuery({
    queryKey: ['plans', menteeId],
    queryFn: async ({ signal }) =>
      (await plansControllerList({ menteeId }, { signal }))
        .data as PlanSummaryDto[],
    enabled: !!menteeId,
  });
  const open = (plans.data ?? []).filter((p) => !p.closedAt);
  if (!menteeId) return null;

  return (
    <Card title={t('plans.updates')}>
      {upcoming ? (
        <p className="text-sm text-ink-subtle">{t('plans.updatesUpcoming')}</p>
      ) : open.length === 0 ? (
        <p className="text-sm text-ink-subtle">{t('plans.noPlans')}</p>
      ) : (
        <>
          <p className="text-[13px] text-ink-subtle">
            {t('plans.updatesHint')}
          </p>
          <ul className="flex flex-col divide-y divide-divider">
            {open.map((p) => {
              const raw = values[p.id] ?? '';
              const next = raw.trim() === '' ? null : Number(raw);
              const delta =
                next !== null && p.latest !== null && Number.isFinite(next)
                  ? next - p.latest
                  : null;
              const better =
                delta !== null && (p.higherIsBetter ? delta > 0 : delta < 0);
              const worse =
                delta !== null && (p.higherIsBetter ? delta < 0 : delta > 0);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-4 py-3"
                >
                  <div className="flex flex-[1_1_200px] flex-col">
                    <span className="font-semibold text-navy">{p.name}</span>
                    <span className="text-[13px] text-ink-subtle">
                      {i18n.language === 'ar'
                        ? p.trackingMethod.nameAr
                        : p.trackingMethod.nameEn}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[12px] text-ink-subtle">
                      {t('plans.previous')}
                    </span>
                    <span className="font-figures text-lg font-semibold">
                      {p.latest === null
                        ? '—'
                        : formatNumber(p.latest, i18n.language)}
                    </span>
                  </div>
                  <label className="flex flex-col items-center gap-1 text-[12px] text-ink-subtle">
                    {t('plans.next')}
                    <Input
                      type="number"
                      step="any"
                      dir="ltr"
                      aria-label={`${p.name} · ${t('plans.next')}`}
                      className="h-10 w-24 text-center font-figures text-[15px]"
                      value={raw}
                      onChange={(e) =>
                        onChange({ ...values, [p.id]: e.target.value })
                      }
                    />
                  </label>
                  <span
                    aria-live="polite"
                    className={cn(
                      'w-16 font-figures text-sm font-semibold',
                      better && 'text-trend-up',
                      worse && 'text-trend-down',
                      delta === 0 && 'text-trend-steady',
                    )}
                  >
                    {delta === null
                      ? ''
                      : `${better ? '↑' : worse ? '↓' : '–'} ${formatNumber(Math.abs(delta), i18n.language)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
