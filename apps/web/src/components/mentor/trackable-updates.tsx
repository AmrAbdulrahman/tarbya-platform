import { useTranslation } from 'react-i18next';
import { ValueInput } from '../trackables/format';
import { TrendCard, useActiveTrackables } from '../trackables/trend-cards';

/**
 * BR-TRK-3: each active trackable's trend, with this cycle's value to log with
 * the follow-up (FollowUp.dc.html).
 */
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
  const { active, isSuccess } = useActiveTrackables(menteeId);
  const set = (id: string, value: string) =>
    onChange({ ...values, [id]: value });

  if (isSuccess && !active.length) {
    return (
      <p className="text-sm text-ink-subtle">{t('trackables.noActive')}</p>
    );
  }
  return (
    <>
      <p className="text-[13px] text-ink-subtle">
        {upcoming
          ? t('trackables.updatesUpcoming')
          : t('trackables.updatesHint')}
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
        {active.map((x) => {
          const raw = values[x.id] ?? '';
          const label = `${x.name} · ${t('trackables.next')}`;
          return (
            <TrendCard key={x.id} trackable={x} link={false}>
              {!upcoming && (
                <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-2 text-[12px] text-ink-subtle">
                  <span className="w-full">{t('trackables.next')}</span>
                  <ValueInput
                    trackable={x}
                    label={label}
                    clearable
                    value={raw}
                    onChange={(v) => set(x.id, v)}
                  />
                </div>
              )}
            </TrendCard>
          );
        })}
      </ul>
    </>
  );
}
