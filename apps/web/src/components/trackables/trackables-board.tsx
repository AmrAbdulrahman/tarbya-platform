import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Plus, TrendingUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerEntries,
  trackablesControllerList,
  trackablesControllerLog,
  type RangeEntryDto,
  type TrackableSummaryDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import {
  addDays,
  cycleEnd,
  cycleStart,
  cycleStarts,
  FILL_WINDOW_DAYS,
  formatDayTile,
  formatMonth,
  logDay,
  plainMentions,
  toZoned,
  WEEK_STARTS_ON,
} from '@tarbya/shared';
import { Badge, Button, cn, Input, useToast } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { FormError } from '../login/fields';
import {
  DoneMark,
  ValueInput,
  formatNumber,
  useCycleLabel,
  useFormatValue,
} from './format';
import { FilterChip } from './library';
import { TrackableDialog } from './trackable-dialog';
import { TrendBadge } from './trend';

export const trackablesQueryKey = (menteeId: string) => [
  'trackables',
  menteeId,
];

type Period = 'week' | 'month' | 'custom';

/** The days a period covers, ending today unless picked. */
function periodRange(
  period: Period,
  today: string,
  custom: { from: string; to: string },
) {
  // The whole week, so the days still to come show as placeholders.
  if (period === 'week') {
    const from = cycleStart(today, 'WEEKLY');
    return { from, to: addDays(from, 6) };
  }
  if (period === 'month')
    return { from: cycleStart(today, 'MONTHLY'), to: today };
  return custom.from <= custom.to
    ? custom
    : { from: custom.to, to: custom.from };
}

/**
 * US-4.2, US-5.2: a mentee's trackables, each with its cycles in the chosen
 * period — logged values, missed ones, and ones to log right there.
 */
export function TrackablesBoard({
  menteeId,
  canManage,
  isMentee = false,
}: {
  menteeId: string;
  canManage: boolean;
  /** The mentee's own view: they log only within the last 30 days (BR-TRK-4). */
  isMentee?: boolean;
}) {
  const { t } = useTranslation();
  const today = toZoned(new Date()).date;
  const [period, setPeriod] = useState<Period>('week');
  const [custom, setCustom] = useState({
    from: addDays(today, -13),
    to: today,
  });
  const [adding, setAdding] = useState(false);
  const range = periodRange(period, today, custom);
  // Monthly cycles that overlap the period start before it.
  const fetchFrom = cycleStart(range.from, 'MONTHLY');
  // Nothing is logged ahead of today.
  const fetchTo = range.to < today ? range.to : today;
  const trackables = useQuery({
    queryKey: trackablesQueryKey(menteeId),
    queryFn: async ({ signal }) =>
      (await trackablesControllerList({ menteeId }, { signal }))
        .data as TrackableSummaryDto[],
  });
  const entries = useQuery({
    queryKey: [...trackablesQueryKey(menteeId), 'entries', fetchFrom, fetchTo],
    queryFn: async ({ signal }) =>
      (
        await trackablesControllerEntries(
          { menteeId, from: fetchFrom, to: fetchTo },
          { signal },
        )
      ).data as RangeEntryDto[],
    placeholderData: (previous) => previous,
  });
  const byTrackable = new Map<string, Map<string, RangeEntryDto>>();
  for (const e of entries.data ?? []) {
    const m = byTrackable.get(e.trackableId) ?? new Map();
    m.set(e.periodStart, e);
    byTrackable.set(e.trackableId, m);
  }
  const active = trackables.data?.filter((x) => !x.archivedAt) ?? [];
  const archived = trackables.data?.filter((x) => x.archivedAt) ?? [];

  return (
    <section
      id="trackables"
      aria-labelledby="trackables-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="trackables-title"
          className="flex flex-1 items-center gap-2 text-base font-bold text-brand"
        >
          <TrendingUp className="size-5 text-primary" aria-hidden />
          {t('trackables.title')}
        </h2>
        <div
          role="group"
          aria-label={t('trackables.board.period')}
          className="flex flex-wrap items-center gap-1"
        >
          {(['week', 'month', 'custom'] as const).map((p) => (
            <FilterChip
              key={p}
              pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {p === 'custom' && (
                <CalendarDays className="me-1 inline size-3.5" aria-hidden />
              )}
              {t(`trackables.board.periods.${p}`)}
            </FilterChip>
          ))}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t('trackables.add')}
          </Button>
        )}
      </div>
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-subtle">
          <label className="flex items-center gap-1.5">
            {t('trackables.board.from')}
            <Input
              type="date"
              max={today}
              className="h-8 w-40 text-[13px]"
              value={custom.from}
              onChange={(e) =>
                e.target.value &&
                setCustom((c) => ({ ...c, from: e.target.value }))
              }
            />
          </label>
          <label className="flex items-center gap-1.5">
            {t('trackables.board.to')}
            <Input
              type="date"
              max={today}
              className="h-8 w-40 text-[13px]"
              value={custom.to}
              onChange={(e) =>
                e.target.value &&
                setCustom((c) => ({ ...c, to: e.target.value }))
              }
            />
          </label>
        </div>
      )}
      {(trackables.isError || entries.isError) && (
        <p className="text-sm text-ink-subtle">
          {errorMessage(t, trackables.error ?? entries.error)}
        </p>
      )}
      {trackables.data?.length === 0 && (
        <p className="text-sm text-ink-subtle">{t('trackables.none')}</p>
      )}
      <ul className="flex flex-col divide-y divide-divider">
        {active.map((x) => (
          <TrackableRow
            key={x.id}
            trackable={x}
            range={range}
            byDay={period === 'week'}
            today={today}
            entries={byTrackable.get(x.id) ?? new Map()}
            canLog={canManage || isMentee}
            isMentee={isMentee}
          />
        ))}
      </ul>
      {archived.length > 0 && (
        <p className="flex flex-wrap gap-x-2 text-[13px] text-ink-subtle">
          <span>{t('trackables.board.archived')}</span>
          {archived.map((x) => (
            <Link
              key={x.id}
              to="/trackables/$id"
              params={{ id: x.id }}
              className="hover:text-primary"
            >
              {x.name}
            </Link>
          ))}
        </p>
      )}
      {canManage && (
        <TrackableDialog
          menteeId={menteeId}
          open={adding}
          onOpenChange={setAdding}
        />
      )}
    </section>
  );
}

function TrackableRow({
  trackable: tr,
  range,
  byDay,
  today,
  entries,
  canLog,
  isMentee,
}: {
  trackable: TrackableSummaryDto;
  range: { from: string; to: string };
  /** One column per day of the week, so a weekly log sits under its weekday. */
  byDay: boolean;
  today: string;
  entries: Map<string, RangeEntryDto>;
  canLog: boolean;
  isMentee: boolean;
}) {
  const { t, i18n } = useTranslation();
  const formatValue = useFormatValue();
  const cycleLabel = useCycleLabel();
  const [selected, setSelected] = useState<string | null>(null);
  const first = cycleStart(tr.startsOn, tr.cycle);
  const current = cycleStart(today, tr.cycle);
  // Every cycle in the period. Ones before the start can be logged too, which
  // moves the start back (BR-TRK-4); ones still to come wait.
  const cycles = cycleStarts(range.from, range.to, tr.cycle);
  // The mentee fills cycles that ended within the last 30 days.
  const loggable = (start: string) =>
    canLog &&
    start <= current &&
    (!isMentee ||
      cycleEnd(start, tr.cycle) >= addDays(today, -FILL_WINDOW_DAYS));
  const notes = cycles
    .map((s) => entries.get(s))
    .filter(
      (e): e is RangeEntryDto => !!e && (!!e.note || e.replies.length > 0),
    )
    .reverse();

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          to="/trackables/$id"
          params={{ id: tr.id }}
          className="text-[15px] font-bold text-brand hover:text-primary"
        >
          {tr.name}
        </Link>
        <span className="text-[13px] text-ink-subtle">
          {t(`trackables.cycles.${tr.cycle}`)}
          {tr.target !== null &&
            ` · ${t('trackables.of', { target: formatNumber(tr.target, i18n.language) })}`}
          {' · '}
          {t('trackables.stats', { logged: tr.logged, missed: tr.missed })}
        </span>
        <span className="ms-auto">
          <TrendBadge trend={tr.trend} />
        </span>
      </div>
      {tr.goal && <p className="-mt-1 text-[13px] text-ink-muted">{tr.goal}</p>}
      {cycles.length === 0 ? (
        <p className="text-[13px] text-ink-subtle">
          {t('trackables.board.noCycles')}
        </p>
      ) : (
        <div
          className={
            byDay ? 'grid grid-cols-7 gap-1.5' : 'flex flex-wrap gap-1.5'
          }
        >
          {cycles.map((s) => {
            const entry = entries.get(s);
            const canPick = loggable(s);
            const missed =
              !entry && s >= first && cycleEnd(s, tr.cycle) < today;
            const ahead = s > current;
            return (
              <button
                key={s}
                type="button"
                disabled={!canPick}
                aria-pressed={selected === s}
                aria-label={`${cycleLabel(s, tr.cycle, tr.weekday)}: ${
                  entry
                    ? t('trackables.board.loggedAria')
                    : missed
                      ? t('trackables.board.missed')
                      : ahead
                        ? t('trackables.board.ahead')
                        : t('trackables.board.open')
                }`}
                onClick={() => setSelected(selected === s ? null : s)}
                style={
                  byDay && tr.weekday !== null
                    ? {
                        gridColumnStart:
                          ((tr.weekday - WEEK_STARTS_ON + 7) % 7) + 1,
                      }
                    : undefined
                }
                className={cn(
                  byDay ? 'min-w-0' : 'min-w-14',
                  'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1 text-[12px] leading-tight transition-colors',
                  entry
                    ? 'border-border bg-surface'
                    : ahead
                      ? 'border-dashed border-border opacity-50'
                      : missed
                        ? 'border-dashed border-trend-down/40 bg-red-50/40'
                        : 'border-dashed border-primary/50 bg-primary-tint/40',
                  s === current && 'ring-2 ring-primary/40',
                  selected === s && 'border-primary bg-primary-tint',
                  canPick
                    ? 'cursor-pointer hover:border-primary'
                    : 'cursor-default',
                )}
              >
                <CycleTile start={s} cycle={tr.cycle} weekday={tr.weekday} />
                <span className="flex h-6 items-center font-figures text-[15px] font-semibold text-brand">
                  {entry ? (
                    formatValue(entry.value, tr.type)
                  ) : ahead || !canPick ? (
                    <span className="text-ink-subtle">—</span>
                  ) : (
                    <Plus
                      className={cn(
                        'size-4',
                        missed ? 'text-trend-down' : 'text-primary',
                      )}
                      aria-hidden
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {selected && (
        <QuickLog
          key={selected}
          trackable={tr}
          periodStart={selected}
          entry={entries.get(selected)}
          onDone={() => setSelected(null)}
        />
      )}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 border-s-2 border-divider ps-3">
          {notes.map((e) => (
            <li key={e.id} className="text-[13px]">
              <span className="text-ink-subtle">
                {cycleLabel(e.periodStart, tr.cycle, tr.weekday)} ·{' '}
                {actedBy(t, e.author, e.impersonator)}:
              </span>{' '}
              {e.note}
              {e.replies.map((r) => (
                <span key={r.id} className="block text-ink-muted">
                  ↳ {actedBy(t, r.author, r.impersonator)}:{' '}
                  {plainMentions(r.body)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** A cycle's short name: the day for daily and weekly cycles, the month for monthly. */
function CycleTile({
  start,
  cycle,
  weekday,
}: {
  start: string;
  cycle: TrackableSummaryDto['cycle'];
  /** A weekly cycle shows on this weekday when one is chosen. */
  weekday?: number | null;
}) {
  const { i18n } = useTranslation();
  const me = useMe();
  const locale = i18n.language as Language;
  const at = `${logDay(start, cycle, weekday)}T12:00:00Z`;
  if (cycle === 'MONTHLY') {
    return (
      <span className="text-ink-subtle">{formatMonth(at, { locale })}</span>
    );
  }
  const tile = formatDayTile(at, { locale, calendar: me.calendar });
  return (
    <span className="text-ink-subtle">
      {tile.day} {tile.month}
    </span>
  );
}

/** Logs or re-logs one cycle right in the board. */
function QuickLog({
  trackable: tr,
  periodStart,
  entry,
  onDone,
}: {
  trackable: TrackableSummaryDto;
  periodStart: string;
  entry?: RangeEntryDto;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const cycleLabel = useCycleLabel();
  const [value, setValue] = useState(entry ? String(entry.value) : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const label = cycleLabel(periodStart, tr.cycle, tr.weekday);
  const log = useMutation({
    mutationFn: (v: number) =>
      trackablesControllerLog(tr.id, periodStart, {
        value: v,
        note: note.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all(
        [['trackables'], ['dashboard'], ['feed', tr.menteeId]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      toast(t('trackables.logged'));
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() !== '' && Number.isFinite(Number(value)))
      log.mutate(Number(value));
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-1.5 rounded-lg border border-primary/30 bg-primary-tint/30 p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-brand">{label}</span>
        {entry && (
          <Badge>
            {t('trackables.board.current')}{' '}
            {tr.type === 'BOOLEAN' ? (
              <DoneMark done={entry.value >= 1} className="ms-1 size-3.5" />
            ) : (
              entry.value
            )}
          </Badge>
        )}
        <ValueInput
          trackable={tr}
          label={`${label} · ${t('trackables.value')}`}
          autoFocus
          value={value}
          onChange={setValue}
        />
        <Input
          aria-label={`${label} · ${t('trackables.note')}`}
          placeholder={t('trackables.note')}
          className="h-9 min-w-40 flex-1 text-[13px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          disabled={log.isPending || value.trim() === ''}
        >
          {t('trackables.log')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t('admin.common.cancel')}
        </Button>
      </div>
      <FormError
        message={log.isError ? errorMessage(t, log.error) : undefined}
      />
    </form>
  );
}
