import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Check, Globe, Lock, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerSaveAsTemplate,
  trackableTemplatesControllerAssign,
  type TrackableDetailDto,
  type TrackableTemplateDto,
} from '@tarbya/api-client';
import { toZoned } from '@tarbya/shared';
import { Badge, Button, Checkbox, cn, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { Field, FormError } from '../login/fields';
import { formatNumber } from './format';

export const templatesQueryKey = (menteeId?: string) =>
  menteeId ? ['trackable-templates', menteeId] : ['trackable-templates'];

/** Everything that shows trackables or templates. */
export function useRefreshTrackables() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [['trackables'], ['trackable-templates'], ['dashboard']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

type Filter = 'all' | 'mine' | 'shared';

/** One line of type, cycle, direction and target. */
export function useShapeLabel() {
  const { t, i18n } = useTranslation();
  return (x: {
    type: TrackableTemplateDto['type'];
    cycle: TrackableTemplateDto['cycle'];
    higherIsBetter: boolean;
    target: number | null;
  }) =>
    [
      t(`trackables.cycles.${x.cycle}`),
      t(`trackables.types.${x.type}`),
      x.higherIsBetter
        ? t('trackables.higherBetter')
        : t('trackables.lowerBetter'),
      x.target !== null &&
        t('trackables.of', { target: formatNumber(x.target, i18n.language) }),
    ]
      .filter(Boolean)
      .join(' · ');
}

/**
 * US-4.9: the library — the viewer's templates and those shared by other
 * mentors, with search and a mine/shared filter; or start from scratch.
 */
export function LibraryPicker({
  templates,
  onPick,
  onCreate,
}: {
  templates: TrackableTemplateDto[];
  onPick: (template: TrackableTemplateDto) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const shape = useShapeLabel();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = query.trim().toLowerCase();
  const shown = templates.filter(
    (x) =>
      (filter === 'all' || (filter === 'mine') === (x.author.id === me.id)) &&
      (!q ||
        x.name.toLowerCase().includes(q) ||
        x.goal?.toLowerCase().includes(q) ||
        x.author.name.toLowerCase().includes(q)),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            type="search"
            aria-label={t('trackables.library.search')}
            placeholder={t('trackables.library.search')}
            className="h-10 ps-9 text-[15px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button size="sm" className="h-10" onClick={onCreate}>
          <Plus aria-hidden />
          {t('trackables.library.createNew')}
        </Button>
      </div>
      <div
        role="group"
        aria-label={t('trackables.library.filter')}
        className="flex gap-1"
      >
        {(['all', 'mine', 'shared'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'primary' : 'ghost'}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {t(`trackables.library.filters.${f}`)}
          </Button>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="text-sm text-ink-subtle">
          {t('trackables.library.noMatch')}
        </p>
      )}
      <ul className="-mx-2 flex max-h-[50vh] flex-col overflow-y-auto">
        {shown.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              disabled={x.assigned}
              onClick={() => onPick(x)}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg px-2 py-3 text-start',
                'hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary',
                'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-navy">
                  {x.name}
                </span>
                {x.assigned && (
                  <Badge tone="success">
                    <Check className="me-1 size-3.5" aria-hidden />
                    {t('trackables.library.assigned')}
                  </Badge>
                )}
              </span>
              {x.goal && (
                <span className="text-[13px] text-ink-muted">{x.goal}</span>
              )}
              <span className="text-[13px] text-ink-subtle">{shape(x)}</span>
              <TemplateByline template={x} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Author, sharing and use — so it's always clear whose template it is. */
export function TemplateByline({
  template: x,
}: {
  template: TrackableTemplateDto;
}) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-subtle">
      <span>
        {x.author.id === me.id && !x.impersonator
          ? t('trackables.library.byYou')
          : t('trackables.library.by', {
              name: actedBy(t, x.author, x.impersonator),
            })}
      </span>
      <span className="inline-flex items-center gap-1">
        {x.isPublic ? (
          <Globe className="size-3.5" aria-hidden />
        ) : (
          <Lock className="size-3.5" aria-hidden />
        )}
        {x.isPublic
          ? t('trackables.library.public')
          : t('trackables.library.private')}
      </span>
      <span>{t('trackables.library.uses', { count: x.uses })}</span>
    </span>
  );
}

/** Gives the mentee their own trackable from the template: target and start. */
export function AssignForm({
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
  const shape = useShapeLabel();
  const refresh = useRefreshTrackables();
  const today = toZoned(new Date()).date;
  const [target, setTarget] = useState(
    template.target === null ? '' : String(template.target),
  );
  const [startsOn, setStartsOn] = useState(today);
  const assign = useMutation({
    mutationFn: async () =>
      (
        await trackableTemplatesControllerAssign(template.id, {
          menteeId,
          startsOn,
          target:
            template.type === 'BOOLEAN' || target.trim() === ''
              ? null
              : Number(target),
        })
      ).data as TrackableDetailDto,
    onSuccess: async (tr) => {
      await refresh();
      onDone(tr);
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        assign.mutate();
      }}
    >
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface/60 p-4">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-navy">
          <BookMarked className="size-4 text-primary" aria-hidden />
          {template.name}
        </span>
        {template.goal && (
          <span className="text-[13px] text-ink-muted">{template.goal}</span>
        )}
        <span className="text-[13px] text-ink-subtle">{shape(template)}</span>
        <TemplateByline template={template} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {template.type !== 'BOOLEAN' && (
          <Field id="assign-target" label={t('trackables.target')}>
            <Input
              id="assign-target"
              type="number"
              min={0}
              max={template.type === 'PERCENTAGE' ? 100 : undefined}
              step="any"
              dir="ltr"
              className="h-11 font-figures text-[15px]"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
        )}
        <Field id="assign-starts" label={t('trackables.startsOn')}>
          <Input
            id="assign-starts"
            type="date"
            max={today}
            className="h-11 text-[15px]"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </Field>
      </div>
      <p className="text-[13px] text-ink-subtle">
        {t('trackables.library.followsHint')}
      </p>
      <FormError
        message={assign.isError ? errorMessage(t, assign.error) : undefined}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={assign.isPending || !startsOn}>
          {t('trackables.library.assign')}
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          {t('trackables.library.back')}
        </Button>
      </div>
    </form>
  );
}

/** "Save as template", with the choice to share it with every mentor. */
export function SaveAsTemplate({
  trackableId,
  onSaved,
  extra,
}: {
  trackableId: string;
  onSaved: (trackable: TrackableDetailDto) => void;
  /** Another button beside "Save as template". */
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const refresh = useRefreshTrackables();
  const [isPublic, setIsPublic] = useState(false);
  const save = useMutation({
    mutationFn: async () =>
      (await trackablesControllerSaveAsTemplate(trackableId, { isPublic }))
        .data as TrackableDetailDto,
    onSuccess: async (tr) => {
      await refresh();
      onSaved(tr);
    },
  });
  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        id={`share-${trackableId}`}
        label={t('trackables.library.shareLabel')}
        hint={t('trackables.library.shareHint')}
        checked={isPublic}
        onChange={(e) => setIsPublic(e.target.checked)}
      />
      <FormError
        message={save.isError ? errorMessage(t, save.error) : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          <BookMarked aria-hidden />
          {t('trackables.library.save')}
        </Button>
        {extra}
      </div>
    </div>
  );
}
