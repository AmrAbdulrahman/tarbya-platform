import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMe } from '../../../auth/session';
import { ChallengesPanel } from '../../../components/mentee/challenges-panel';
import { TrackablesBoard } from '../../../components/trackables/trackables-board';
import { Breadcrumbs } from '../../../components/breadcrumbs';

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
      <h1 className="text-2xl font-bold text-navy">{t('trackables.mine')}</h1>
      <TrackablesBoard menteeId={me.id} canManage={false} isMentee />
      <ChallengesPanel menteeId={me.id} canManage={false} />
    </>
  );
}
