import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { plansControllerList, type PlanSummaryDto } from '@tarbya/api-client';
import { Button } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { PlanCard } from './plan-card';
import { PlanDialog } from './plan-dialog';

/** A member's plans, with "new plan" for their mentor and moderators. */
export function PlansSection({
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
  const plans = useQuery({
    queryKey: ['plans', menteeId],
    queryFn: async ({ signal }) =>
      (await plansControllerList({ menteeId }, { signal }))
        .data as PlanSummaryDto[],
  });

  return (
    <section
      id="plans"
      aria-labelledby="plans-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="plans-title" className="flex-1 text-xl font-bold text-navy">
          {title ?? t('plans.title')}
        </h2>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t('plans.add')}
          </Button>
        )}
      </div>
      {plans.isError && (
        <p className="text-ink-subtle">{errorMessage(t, plans.error)}</p>
      )}
      {plans.data?.length === 0 && (
        <p className="text-ink-subtle">{t('plans.none')}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.data?.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
      {canManage && (
        <PlanDialog
          menteeId={menteeId}
          open={adding}
          onOpenChange={setAdding}
        />
      )}
    </section>
  );
}
