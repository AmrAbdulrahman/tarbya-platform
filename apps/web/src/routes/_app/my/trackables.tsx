import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMe } from '../../../auth/session';
import { ChallengesPanel } from '../../../components/mentee/challenges-panel';
import { TrackablesBoard } from '../../../components/trackables/trackables-board';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { PageHeader } from '../../../components/page-header';

/** US-5.2: a mentee's own trackables, and the challenges they're working through. */
export const Route = createFileRoute('/_app/my/trackables')({
  component: MyTrackablesPage,
});

function MyTrackablesPage() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t('nav.journeyOverview'), to: '/my' },
          { label: t('trackables.mine') },
        ]}
      />
      <PageHeader>
        <h1 className="text-2xl font-bold text-brand">
          {t('trackables.mine')}
        </h1>
      </PageHeader>
      <TrackablesBoard menteeId={me.id} canManage={false} isMentee />
      <ChallengesPanel menteeId={me.id} canManage={false} />
    </>
  );
}
