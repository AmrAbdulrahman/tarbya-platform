import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMe } from '../../../auth/session';
import { ChallengesPanel } from '../../../components/mentee/challenges-panel';
import { TrackablesSection } from '../../../components/trackables/trackables-section';

/** US-5.2: a mentee's own trackables, and the challenges they're working through. */
export const Route = createFileRoute('/_app/my/trackables')({
  component: MyTrackablesPage,
});

function MyTrackablesPage() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <>
      <h1 className="text-3xl font-bold text-navy">{t('trackables.mine')}</h1>
      <TrackablesSection
        menteeId={me.id}
        canManage={false}
        title={t('trackables.title')}
      />
      <ChallengesPanel menteeId={me.id} canManage={false} />
    </>
  );
}
