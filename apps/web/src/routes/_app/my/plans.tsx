import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMe } from '../../../auth/session';
import { PlansSection } from '../../../components/plans/plans-section';

/** US-5.1/5.2: a mentee's own plans. */
export const Route = createFileRoute('/_app/my/plans')({
  component: MyPlansPage,
});

function MyPlansPage() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <>
      <h1 className="text-3xl font-bold text-navy">{t('plans.mine')}</h1>
      <PlansSection
        menteeId={me.id}
        canManage={false}
        title={t('plans.title')}
      />
    </>
  );
}
