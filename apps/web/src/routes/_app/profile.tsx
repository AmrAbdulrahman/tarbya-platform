import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { meControllerProfile, type MyProfileDto } from '@tarbya/api-client';
import { errorMessage } from '../../auth/error-message';
import { meQuery } from '../../auth/session';
import { ContactSection } from '../../components/profile/contact-section';
import { NotificationsSection } from '../../components/profile/notifications-section';
import { PasswordSection } from '../../components/profile/password-section';
import { PictureSection } from '../../components/profile/picture-section';
import { PreferencesSection } from '../../components/profile/preferences-section';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageHeader } from '../../components/page-header';

/** E2: US-2.1 … US-2.4 · design/screens/Profile.dc.html */
export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
});

const queryKey = ['me', 'profile'];
const sections = [
  ['pic', 'me.picAndName'],
  ['lang', 'me.language'],
  ['contact', 'me.contact'],
  ['pw', 'me.password'],
  ['notif', 'me.notifications'],
] as const;

function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await meControllerProfile({ signal })).data as MyProfileDto,
  });
  // The header and sidebar read /auth/me: refresh it whenever the profile changes.
  const onSaved = async (p?: MyProfileDto) => {
    if (p) queryClient.setQueryData(queryKey, p);
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
    if (!p) await queryClient.invalidateQueries({ queryKey });
  };

  if (!profile.data) {
    return (
      <p className="text-ink-subtle">
        {profile.isError
          ? errorMessage(t, profile.error)
          : t('admin.common.loading')}
      </p>
    );
  }
  const p = profile.data;
  return (
    <div className="flex flex-wrap items-start gap-8">
      <nav
        aria-label={t('me.sections')}
        className="sticky top-24 flex flex-[0_1_200px] flex-col gap-1 max-lg:hidden"
      >
        {sections.map(([id, label]) => (
          // A router link: a bare "#id" resolves against <base href="/"> and leaves the page.
          <Link
            key={id}
            to="/profile"
            hash={id}
            hashScrollIntoView={{ behavior: 'smooth', block: 'start' }}
            className="rounded-lg px-3 py-2 text-[15px] text-ink-muted hover:bg-card hover:text-primary"
          >
            {t(label)}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 max-w-3xl flex-[1_1_560px] flex-col gap-4">
        <Breadcrumbs items={[{ label: t('me.title') }]} />
        <PageHeader>
          <h1 className="text-2xl font-bold text-brand">{t('me.title')}</h1>
        </PageHeader>
        <PictureSection profile={p} onSaved={onSaved} />
        <PreferencesSection profile={p} onSaved={onSaved} />
        <ContactSection profile={p} onSaved={onSaved} />
        <PasswordSection profile={p} onSaved={() => onSaved()} />
        <NotificationsSection />
      </div>
    </div>
  );
}
