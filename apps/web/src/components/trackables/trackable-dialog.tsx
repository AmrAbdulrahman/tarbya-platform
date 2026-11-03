import { useMutation, useQuery } from '@tanstack/react-query';
import { BookMarked, CircleCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerCreate,
  trackablesControllerUpdate,
  trackableTemplatesControllerAssign,
  trackableTemplatesControllerList,
  trackableTemplatesControllerUpdate,
  type TrackableDetailDto,
  type TrackableTemplateDto,
} from '@tarbya/api-client';
import { Button, Dialog, DialogContent, useToast } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import {
  LibraryPicker,
  SaveAsTemplate,
  TemplateByline,
  templatesQueryKey,
  useRefreshTrackables,
} from './library';
import {
  sharedFields,
  TrackableForm,
  type TrackableValues,
} from './trackable-form';

interface Props {
  menteeId: string;
  /** Absent to add one. */
  trackable?: TrackableDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** US-4.5, US-4.9: add a trackable (from the library or new), or edit one. */
export function TrackableDialog({
  menteeId,
  trackable,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={trackable ? t('trackables.editTitle') : title}
        closeLabel={t('admin.common.close')}
      >
        {trackable ? (
          <EditTrackable
            key={trackable.id}
            trackable={trackable}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          open && (
            <AddTrackable
              menteeId={menteeId}
              onTitle={setTitle}
              onDone={() => onOpenChange(false)}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

type Step =
  | { kind: 'library' }
  | { kind: 'form' }
  | { kind: 'assign'; template: TrackableTemplateDto }
  | { kind: 'created'; trackable: TrackableDetailDto };

/**
 * With nothing in the library the form opens straight away; otherwise the
 * library comes first, with "create new" beside it. A new trackable can then
 * be saved as a template.
 */
function AddTrackable({
  menteeId,
  onTitle,
  onDone,
}: {
  menteeId: string;
  onTitle: (title: string) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const refresh = useRefreshTrackables();
  const templates = useQuery({
    queryKey: templatesQueryKey(menteeId),
    queryFn: async ({ signal }) =>
      (await trackableTemplatesControllerList({ menteeId }, { signal }))
        .data as TrackableTemplateDto[],
  });
  const [chosen, setStep] = useState<Step | null>(null);
  const hasLibrary = !!templates.data?.length;
  const step: Step | null =
    chosen ??
    (templates.data ? { kind: hasLibrary ? 'library' : 'form' } : null);
  const create = useMutation({
    mutationFn: async (v: Parameters<typeof sharedFields>[0]) =>
      (
        await trackablesControllerCreate({
          ...sharedFields(v),
          menteeId,
          type: v.type,
          cycle: v.cycle,
          startsOn: v.startsOn,
        })
      ).data as TrackableDetailDto,
    onSuccess: async (trackable) => {
      await refresh();
      setStep({ kind: 'created', trackable });
    },
  });
  const added = (name: string) => {
    toast(t('trackables.library.added', { name }));
    onDone();
  };

  const titles = {
    library: t('trackables.library.title'),
    form: t('trackables.newTitle'),
    assign: t('trackables.library.assignTitle'),
    created: t('trackables.library.createdTitle'),
  };
  const title = step ? titles[step.kind] : t('trackables.newTitle');
  useEffect(() => onTitle(title), [onTitle, title]);

  if (!step) {
    return (
      <p className="text-sm text-ink-subtle">
        {templates.isError
          ? errorMessage(t, templates.error)
          : t('admin.common.loading')}
      </p>
    );
  }
  switch (step.kind) {
    case 'library':
      return (
        <LibraryPicker
          templates={templates.data ?? []}
          onPick={(template) => setStep({ kind: 'assign', template })}
          onCreate={() => setStep({ kind: 'form' })}
        />
      );
    case 'assign':
      return (
        <FromTemplate
          key={step.template.id}
          template={step.template}
          menteeId={menteeId}
          onBack={() => setStep({ kind: 'library' })}
          onDone={(tr) => added(tr.name)}
        />
      );
    case 'form':
      return (
        <TrackableForm
          showStart
          pending={create.isPending}
          error={create.isError ? errorMessage(t, create.error) : undefined}
          onSubmit={(v) => create.mutate(v)}
          onCancel={() =>
            hasLibrary ? setStep({ kind: 'library' }) : onDone()
          }
        />
      );
    case 'created':
      return (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 text-[15px]">
            <CircleCheck
              className="mt-0.5 size-5 shrink-0 text-trend-up"
              aria-hidden
            />
            <span>
              {t('trackables.library.createdBody', {
                name: step.trackable.name,
              })}
            </span>
          </p>
          <p className="text-[13px] text-ink-subtle">
            {t('trackables.library.saveHint')}
          </p>
          <SaveAsTemplate
            trackableId={step.trackable.id}
            onSaved={() => {
              toast(t('trackables.library.savedToast'));
              onDone();
            }}
            extra={
              <Button variant="outline" onClick={onDone}>
                {t('trackables.library.notNow')}
              </Button>
            }
          />
        </div>
      );
  }
}

/**
 * The template's fields, ready to adjust before anything is created. Kept as
 * they are (target and start aside), the trackable follows the template;
 * changing the rest makes it the mentee's own, outside the library.
 */
function FromTemplate({
  template,
  menteeId,
  onBack,
  onDone,
}: {
  template: TrackableTemplateDto;
  menteeId: string;
  onBack: () => void;
  onDone: (trackable: TrackableDetailDto) => void;
}) {
  const { t } = useTranslation();
  const refresh = useRefreshTrackables();
  const save = useMutation({
    mutationFn: async (v: TrackableValues) => {
      const shared = sharedFields(v);
      const follows =
        shared.name === template.name &&
        shared.goal === (template.goal ?? null) &&
        v.type === template.type &&
        v.cycle === template.cycle &&
        shared.higherIsBetter === template.higherIsBetter;
      const res = follows
        ? await trackableTemplatesControllerAssign(template.id, {
            menteeId,
            target: shared.target,
            startsOn: v.startsOn,
          })
        : await trackablesControllerCreate({
            ...shared,
            menteeId,
            type: v.type,
            cycle: v.cycle,
            startsOn: v.startsOn,
          });
      return res.data as TrackableDetailDto;
    },
    onSuccess: async (tr) => {
      await refresh();
      onDone(tr);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface/60 px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-navy">
          <BookMarked className="size-4 text-primary" aria-hidden />
          {t('trackables.library.fromTemplate', { name: template.name })}
        </span>
        <TemplateByline template={template} />
      </div>
      <TrackableForm
        initial={template}
        showStart
        notice={
          <p className="text-[13px] text-ink-subtle">
            {t('trackables.library.adjustHint')}
          </p>
        }
        submitLabel={t('trackables.library.assign')}
        pending={save.isPending}
        error={save.isError ? errorMessage(t, save.error) : undefined}
        onSubmit={(v) => save.mutate(v)}
        onCancel={onBack}
        cancelLabel={t('trackables.library.back')}
      />
    </div>
  );
}

/** A trackable that follows a template only changes its target and start here. */
function EditTrackable({
  trackable,
  onDone,
}: {
  trackable: TrackableDetailDto;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const refresh = useRefreshTrackables();
  // Type, cycle and start are fixed once something is logged (BR-TRK-1).
  const reshapable = trackable.logged === 0;
  const fromTemplate = !!trackable.template;
  const save = useMutation({
    mutationFn: (v: Parameters<typeof sharedFields>[0]) => {
      const shared = sharedFields(v);
      return trackablesControllerUpdate(trackable.id, {
        ...(fromTemplate ? { target: shared.target } : shared),
        ...(reshapable && {
          startsOn: v.startsOn,
          ...(!fromTemplate && { type: v.type, cycle: v.cycle }),
        }),
      });
    },
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });
  return (
    <TrackableForm
      initial={trackable}
      lockShape={!reshapable}
      lockShared={fromTemplate}
      showStart={reshapable}
      notice={
        <p className="text-[13px] text-ink-subtle">
          {fromTemplate
            ? t('trackables.library.followsHint')
            : !reshapable && t('trackables.fixedHint')}
        </p>
      }
      pending={save.isPending}
      error={save.isError ? errorMessage(t, save.error) : undefined}
      onSubmit={(v) => save.mutate(v)}
      onCancel={onDone}
    />
  );
}

/** Edits a library template; the change reaches every trackable that follows it. */
export function TemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: TrackableTemplateDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const refresh = useRefreshTrackables();
  const save = useMutation({
    mutationFn: (v: Parameters<typeof sharedFields>[0]) =>
      trackableTemplatesControllerUpdate(template.id, {
        ...sharedFields(v),
        isPublic: v.isPublic,
        ...(template.reshapable && { type: v.type, cycle: v.cycle }),
      }),
    onSuccess: async () => {
      await refresh();
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('trackables.library.editTitle')}
        closeLabel={t('admin.common.close')}
      >
        {open && (
          <TrackableForm
            initial={template}
            lockShape={!template.reshapable}
            showPublic
            notice={
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-warn">
                {t('trackables.library.editWarning', { count: template.uses })}
              </p>
            }
            pending={save.isPending}
            error={save.isError ? errorMessage(t, save.error) : undefined}
            onSubmit={(v) => save.mutate(v)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
