import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  lookupsControllerActivityTypes,
  type ActivityScope,
  type ActivityTypeDto,
} from '@tarbya/api-client';
import { Badge, Button, cn } from '@tarbya/ui';
import { ActivityTypeEditor } from '../../../components/admin/activity-type-editor';
import { lookupColors } from '../../../components/admin/lookup-colors';

/** US-3.5 · design/screens/ActivityTypes.dc.html */
export const Route = createFileRoute('/_app/admin/lookups')({
  component: LookupsPage,
});

const TABS = ['all', 'INDIVIDUAL', 'GROUP_RECURRING', 'GROUP_ONE_OFF'] as const;
type Tab = (typeof TABS)[number];

function LookupsPage() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('all');
  const [selected, setSelected] = useState<ActivityTypeDto | 'new' | null>(
    null,
  );
  const types = useQuery({
    queryKey: ['activity-types'],
    queryFn: async ({ signal }) =>
      (await lookupsControllerActivityTypes({ signal }))
        .data as ActivityTypeDto[],
  });
  const all = types.data ?? [];
  const visible = tab === 'all' ? all : all.filter((x) => x.scope === tab);
  const count = (tab: Tab) =>
    tab === 'all' ? all.length : all.filter((x) => x.scope === tab).length;
  const name = (x: ActivityTypeDto) =>
    i18n.language === 'ar' ? x.nameAr : x.nameEn;
  const other = (x: ActivityTypeDto) =>
    i18n.language === 'ar' ? x.nameEn : x.nameAr;

  const flags = (x: ActivityTypeDto) =>
    [
      x.requiresRsvp && t('admin.lookups.flagRsvp'),
      x.tracksAttendance && t('admin.lookups.flagAttendance'),
      x.reminder !== 'NONE' && t('admin.lookups.flagReminder'),
    ]
      .filter(Boolean)
      .join(' · ') || t('admin.common.none');

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-3xl font-bold text-navy">
            {t('admin.lookups.title')}
          </h1>
          <p className="text-[15px] text-ink-subtle">
            {t('admin.lookups.lead')}
          </p>
        </div>
        <Button onClick={() => setSelected('new')}>
          <Plus aria-hidden />
          {t('admin.lookups.add')}
        </Button>
      </div>

      <div
        role="tablist"
        aria-label={t('admin.lookups.scopeTabs')}
        className="flex flex-wrap gap-2"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold',
              tab === id
                ? 'border-navy bg-navy text-white'
                : 'border-border bg-card text-ink-muted hover:text-primary',
            )}
          >
            {id === 'all'
              ? t('admin.lookups.all')
              : t(`admin.lookups.scopes.${id as ActivityScope}`)}
            <span className="font-figures text-xs opacity-80">{count(id)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="min-w-0 flex-[2_1_560px] overflow-x-auto rounded-card border border-border bg-card">
          <table className="w-full min-w-[560px] text-[15px]">
            <thead className="bg-surface text-[13px] text-ink-subtle">
              <tr>
                {(['type', 'scope', 'flags', 'status'] as const).map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-5 py-3 text-start font-semibold"
                  >
                    {t(`admin.lookups.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((x) => {
                const colors = lookupColors[x.color];
                const on = selected !== 'new' && selected?.id === x.id;
                return (
                  <tr
                    key={x.id}
                    className={cn(
                      'border-t border-divider',
                      on ? 'bg-primary-tint/50' : 'hover:bg-slate-50',
                    )}
                  >
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(x)}
                        className="flex items-center gap-3 text-start"
                      >
                        <span
                          aria-hidden
                          style={{
                            backgroundColor: colors.tint,
                            color: colors.text,
                          }}
                          className="grid size-9 shrink-0 place-items-center rounded-lg font-bold"
                        >
                          {name(x).charAt(0)}
                        </span>
                        <span className="flex flex-col">
                          <span className="font-semibold text-navy">
                            {name(x)}
                          </span>
                          <span
                            lang={i18n.language === 'ar' ? 'en' : 'ar'}
                            className="text-[13px] text-ink-subtle"
                          >
                            {other(x)}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {t(`admin.lookups.scopeNames.${x.scope}`)}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{flags(x)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={x.active ? 'success' : 'neutral'}>
                        {x.active
                          ? t('admin.lookups.active')
                          : t('admin.lookups.inactive')}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {types.isPending && (
            <p className="px-5 py-4 text-ink-subtle">
              {t('admin.common.loading')}
            </p>
          )}
        </section>

        {selected && (
          <div className="flex-[1_1_340px]">
            <ActivityTypeEditor
              key={selected === 'new' ? 'new' : selected.id}
              type={selected === 'new' ? undefined : selected}
              onDone={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </>
  );
}
