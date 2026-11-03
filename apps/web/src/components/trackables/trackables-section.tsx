import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerList,
  type TrackableSummaryDto,
} from '@tarbya/api-client';
import { Button } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { TrackableCard } from './trackable-card';
import { TrackableDialog } from './trackable-dialog';

export const trackablesQueryKey = (menteeId: string) => [
  'trackables',
  menteeId,
];

/** A member's trackables, with "new trackable" for their mentor and admins. */
export function TrackablesSection({
  menteeId,
  canManage,
  title,
}: {
  menteeId: string;
  canManage: boolean;
  title?: string;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const trackables = useQuery({
    queryKey: trackablesQueryKey(menteeId),
    queryFn: async ({ signal }) =>
      (await trackablesControllerList({ menteeId }, { signal }))
        .data as TrackableSummaryDto[],
  });

  return (
    <section
      id="trackables"
      aria-labelledby="trackables-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2
          id="trackables-title"
          className="flex-1 text-xl font-bold text-navy"
        >
          {title ?? t('trackables.title')}
        </h2>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t('trackables.add')}
          </Button>
        )}
      </div>
      {trackables.isError && (
        <p className="text-ink-subtle">{errorMessage(t, trackables.error)}</p>
      )}
      {trackables.data?.length === 0 && (
        <p className="text-ink-subtle">{t('trackables.none')}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trackables.data?.map((tr) => (
          <TrackableCard key={tr.id} trackable={tr} />
        ))}
      </div>
      {canManage && (
        <TrackableDialog
          menteeId={menteeId}
          open={adding}
          onOpenChange={setAdding}
        />
      )}
    </section>
  );
}
