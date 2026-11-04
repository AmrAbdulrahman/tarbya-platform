import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  trackableTemplatesControllerList,
  type TrackableTemplateDto,
} from '@tarbya/api-client';
import { errorMessage } from '../../../auth/error-message';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import {
  LibraryList,
  templatesQueryKey,
} from '../../../components/trackables/library';
import { TemplateActions } from '../../../components/trackables/template-card';

/** US-4.9: every template the viewer can use — theirs and those shared with all mentors. */
export const Route = createFileRoute('/_app/trackables/library')({
  component: LibraryPage,
});

function LibraryPage() {
  const { t } = useTranslation();
  const templates = useQuery({
    queryKey: templatesQueryKey(),
    queryFn: async ({ signal }) =>
      (await trackableTemplatesControllerList(undefined, { signal }))
        .data as TrackableTemplateDto[],
  });
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t('nav.menteeDashboard'), to: '/mentor' },
          { label: t('nav.library') },
        ]}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-brand">{t('nav.library')}</h1>
        <p className="text-[15px] text-ink-subtle">
          {t('trackables.library.lead')}
        </p>
      </div>
      <section className="rounded-card border border-border bg-card p-4">
        {templates.data ? (
          <LibraryList
            templates={templates.data}
            actions={(x) => x.canEdit && <TemplateActions template={x} />}
          />
        ) : (
          <p className="text-sm text-ink-subtle">
            {templates.isError
              ? errorMessage(t, templates.error)
              : t('admin.common.loading')}
          </p>
        )}
      </section>
    </>
  );
}
