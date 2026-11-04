import { useTranslation } from 'react-i18next';
import { Input } from '@tarbya/ui';
import { DoneToggle } from '../trackables/format';
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
                <div className="flex items-center gap-2 border-t border-divider pt-2 text-[12px] text-ink-subtle">
                  <span className="flex-1">{t('trackables.next')}</span>
                  {x.type === 'BOOLEAN' ? (
                    // A second click clears it: nothing to log.
                    <DoneToggle
                      label={label}
                      clearable
                      value={raw === '1' || raw === '0' ? raw : ''}
                      onChange={(v) => set(x.id, v)}
                    />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={x.type === 'PERCENTAGE' ? 100 : undefined}
                      step="any"
                      dir="ltr"
                      aria-label={label}
                      className="h-9 w-20 text-center font-figures text-[15px]"
                      value={raw}
                      onChange={(e) => set(x.id, e.target.value)}
                    />
                  )}
                </div>
              )}
            </TrendCard>
          );
        })}
      </ul>
    </>
  );
}
