import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerList,
  type TrackableSummaryDto,
} from '@tarbya/api-client';
import { Input } from '@tarbya/ui';
import { trackablesQueryKey } from '../trackables/trackables-board';
import { DoneToggle, useFormatValue } from '../trackables/format';
import { Card } from './form-parts';

/** BR-TRK-3: this cycle's value for each active trackable, logged with the follow-up (FollowUp.dc.html). */
export function TrackableUpdates({
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
  const { t } = useTranslation();
  const formatValue = useFormatValue();
  const trackables = useQuery({
    queryKey: trackablesQueryKey(menteeId),
    queryFn: async ({ signal }) =>
      (await trackablesControllerList({ menteeId }, { signal }))
        .data as TrackableSummaryDto[],
  });
  const active = (trackables.data ?? []).filter((x) => !x.archivedAt);
  const set = (id: string, value: string) =>
    onChange({ ...values, [id]: value });

  return (
    <Card title={t('trackables.updates')}>
      {upcoming ? (
        <p className="text-sm text-ink-subtle">
          {t('trackables.updatesUpcoming')}
        </p>
      ) : active.length === 0 ? (
        <p className="text-sm text-ink-subtle">{t('trackables.noActive')}</p>
      ) : (
        <>
          <p className="text-[13px] text-ink-subtle">
            {t('trackables.updatesHint')}
          </p>
          <ul className="flex flex-col divide-y divide-divider">
            {active.map((x) => {
              const raw = values[x.id] ?? '';
              const label = `${x.name} · ${t('trackables.next')}`;
              return (
                <li
                  key={x.id}
                  className="flex flex-wrap items-center gap-4 py-3"
                >
                  <div className="flex flex-[1_1_200px] flex-col">
                    <span className="font-semibold text-navy">{x.name}</span>
                    <span className="text-[13px] text-ink-subtle">
                      {t(`trackables.cycles.${x.cycle}`)} ·{' '}
                      {t(`trackables.types.${x.type}`)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[12px] text-ink-subtle">
                      {t('trackables.previous')}
                    </span>
                    <span className="font-figures text-lg font-semibold">
                      {x.latest === null ? '—' : formatValue(x.latest, x.type)}
                    </span>
                  </div>
                  {x.type === 'BOOLEAN' ? (
                    // A second click clears it: nothing to log.
                    <DoneToggle
                      label={label}
                      clearable
                      value={raw === '1' || raw === '0' ? raw : ''}
                      onChange={(v) => set(x.id, v)}
                    />
                  ) : (
                    <label className="flex flex-col items-center gap-1 text-[12px] text-ink-subtle">
                      {t('trackables.next')}
                      <Input
                        type="number"
                        min={0}
                        max={x.type === 'PERCENTAGE' ? 100 : undefined}
                        step="any"
                        dir="ltr"
                        aria-label={label}
                        className="h-10 w-24 text-center font-figures text-[15px]"
                        value={raw}
                        onChange={(e) => set(x.id, e.target.value)}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
