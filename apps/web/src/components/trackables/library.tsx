import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Check, Globe, Lock, Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerSaveAsTemplate,
  type TrackableDetailDto,
  type TrackableTemplateDto,
} from '@tarbya/api-client';
import { matchesSearch } from '@tarbya/shared';
import { Badge, Button, Checkbox, cn, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { FormError } from '../login/fields';
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
 * mentors, with search and a mine/shared filter. With `onPick` each template
 * is a button; `actions` adds controls beside each one.
 */
export function LibraryList({
  templates,
  onPick,
  actions,
  toolbar,
  scroll = false,
}: {
  templates: TrackableTemplateDto[];
  onPick?: (template: TrackableTemplateDto) => void;
  actions?: (template: TrackableTemplateDto) => ReactNode;
  /** Beside the search box, e.g. "create new". */
  toolbar?: ReactNode;
  /** Scroll inside a dialog instead of growing. */
  scroll?: boolean;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const shown = templates.filter(
    (x) =>
      (filter === 'all' || (filter === 'mine') === (x.author.id === me.id)) &&
      matchesSearch(query, x.name, x.goal, x.author.name),
  );

  return (
    <div className="flex flex-col gap-3">
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
            className="h-9 ps-9 text-[15px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {toolbar}
      </div>
      <div
        role="group"
        aria-label={t('trackables.library.filter')}
        className="flex gap-1"
      >
        {(['all', 'mine', 'shared'] as const).map((f) => (
          <FilterChip
            key={f}
            pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {t(`trackables.library.filters.${f}`)}
          </FilterChip>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="text-sm text-ink-subtle">
          {templates.length
            ? t('trackables.library.noMatch')
            : t('trackables.library.empty')}
        </p>
      )}
      <ul
        className={cn(
          'flex flex-col divide-y divide-divider',
          scroll && '-mx-2 max-h-[50vh] overflow-y-auto',
        )}
      >
        {shown.map((x) => {
          const body = <TemplateSummary template={x} />;
          return (
            <li key={x.id} className="flex flex-wrap items-center gap-2">
              {onPick ? (
                <button
                  type="button"
                  disabled={x.assigned}
                  onClick={() => onPick(x)}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2 py-2.5 text-start',
                    'hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary',
                    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
                  )}
                >
                  {body}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5">
                  {body}
                </div>
              )}
              {actions?.(x)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A small toggle chip, for filters. */
export function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-8 rounded-full border px-3 text-[13px] font-medium transition-colors',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-ink-muted hover:border-primary hover:text-primary',
      )}
    >
      {children}
    </button>
  );
}

function TemplateSummary({ template: x }: { template: TrackableTemplateDto }) {
  const { t } = useTranslation();
  const shape = useShapeLabel();
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold text-brand">{x.name}</span>
        {x.assigned && (
          <Badge tone="success">
            <Check className="me-1 size-3.5" aria-hidden />
            {t('trackables.library.assigned')}
          </Badge>
        )}
      </span>
      {x.goal && <span className="text-[13px] text-ink-muted">{x.goal}</span>}
      <span className="text-[13px] text-ink-subtle">{shape(x)}</span>
      <TemplateByline template={x} />
    </>
  );
}

/** Picking from the library in the new-trackable dialog, or starting fresh. */
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
  return (
    <LibraryList
      templates={templates}
      onPick={onPick}
      scroll
      toolbar={
        <Button size="sm" onClick={onCreate}>
          <Plus aria-hidden />
          {t('trackables.library.createNew')}
        </Button>
      }
    />
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

/** "Save as template", with the choice to share it with every mentor. */
export function SaveAsTemplate({
  trackableId,
  onSaved,
  extra,
}: {
  trackableId: string;
  onSaved: (trackable: TrackableDetailDto) => void;
  /** Another button beside "Save as template". */
  extra?: ReactNode;
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
