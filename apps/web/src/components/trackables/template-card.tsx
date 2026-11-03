import { useMutation } from '@tanstack/react-query';
import { BookMarked } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackableTemplatesControllerRemove,
  trackableTemplatesControllerUpdate,
  type TrackableDetailDto,
} from '@tarbya/api-client';
import { Button, useToast } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { FormError } from '../login/fields';
import {
  SaveAsTemplate,
  TemplateByline,
  useRefreshTrackables,
} from './library';
import { TemplateDialog } from './trackable-dialog';

/**
 * US-4.9 on a trackable's page, for its mentor or an admin: the template it
 * follows (whose it is, shared or not, how widely used), or "save as template".
 */
export function TemplateCard({
  trackable: tr,
}: {
  trackable: TrackableDetailDto;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const refresh = useRefreshTrackables();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const template = tr.template;
  const share = useMutation({
    mutationFn: (isPublic: boolean) =>
      trackableTemplatesControllerUpdate(template?.id ?? '', { isPublic }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => trackableTemplatesControllerRemove(template?.id ?? ''),
    onSuccess: async () => {
      await refresh();
      setConfirmRemove(false);
      toast(t('trackables.library.removedToast'));
    },
  });

  return (
    <section
      aria-labelledby="library-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-6"
    >
      <h2
        id="library-title"
        className="flex items-center gap-2 text-lg font-bold text-navy"
      >
        <BookMarked className="size-5 text-primary" aria-hidden />
        {t('trackables.library.cardTitle')}
      </h2>
      {template ? (
        <>
          <p className="text-[15px]">{t('trackables.library.follows')}</p>
          <TemplateByline template={template} />
          {template.canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                {t('trackables.library.edit')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={share.isPending}
                onClick={() => share.mutate(!template.isPublic)}
              >
                {template.isPublic
                  ? t('trackables.library.makePrivate')
                  : t('trackables.library.makePublic')}
              </Button>
              {confirmRemove ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-trend-down text-trend-down"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate()}
                  >
                    {t('trackables.library.confirmRemove')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(false)}
                  >
                    {t('admin.common.cancel')}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmRemove(true)}
                >
                  {t('trackables.library.remove')}
                </Button>
              )}
            </div>
          )}
          {confirmRemove && (
            <p className="text-[13px] text-ink-subtle">
              {t('trackables.library.removeHint')}
            </p>
          )}
          <FormError
            message={
              share.isError
                ? errorMessage(t, share.error)
                : remove.isError
                  ? errorMessage(t, remove.error)
                  : undefined
            }
          />
          {template.canEdit && (
            <TemplateDialog
              template={template}
              open={editing}
              onOpenChange={setEditing}
            />
          )}
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink-subtle">
            {t('trackables.library.saveHint')}
          </p>
          <SaveAsTemplate
            trackableId={tr.id}
            onSaved={() => toast(t('trackables.library.savedToast'))}
          />
        </>
      )}
    </section>
  );
}
