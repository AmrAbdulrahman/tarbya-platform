import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LifeBuoy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackablesControllerGet,
  trackablesControllerLog,
  trackablesControllerReply,
  trackablesControllerUpdate,
  type TrackableDetailDto,
  type TrackableEntryDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import {
  addDays,
  cycleEnd,
  FILL_WINDOW_DAYS,
  formatDate,
  toZoned,
} from '@tarbya/shared';
import {
  Badge,
  Button,
  Checkbox,
  cn,
  Input,
  Textarea,
  useToast,
} from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { actedBy } from '../../../components/acted-by';
import { FormError } from '../../../components/login/fields';
import {
  formatNumber,
  useCycleLabel,
  useFormatValue,
} from '../../../components/trackables/format';
import { TemplateCard } from '../../../components/trackables/template-card';
import { TrackableDialog } from '../../../components/trackables/trackable-dialog';
import { Sparkline, TrendBadge } from '../../../components/trackables/trend';

/** A trackable with its cycles: US-5.2 (log), US-4.7 (reply) · design/screens/MyPlan.dc.html */
export const Route = createFileRoute('/_app/trackables/$id')({
  component: TrackablePage,
});

function TrackablePage() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const me = useMe();
  const queryClient = useQueryClient();
  const queryKey = ['trackables', 'detail', id];
  const trackable = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await trackablesControllerGet(id, { signal }))
        .data as TrackableDetailDto,
  });
  const [editing, setEditing] = useState(false);
  const formatValue = useFormatValue();
  const setTrackable = (tr: TrackableDetailDto) => {
    queryClient.setQueryData(queryKey, tr);
    // Entries and replies show on the dashboards and in the member's history.
    for (const key of [
      ['trackables', tr.menteeId],
      ['dashboard'],
      ['feed', tr.menteeId],
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
  const archive = useMutation({
    mutationFn: async (archived: boolean) =>
      (await trackablesControllerUpdate(id, { archived }))
        .data as TrackableDetailDto,
    onSuccess: setTrackable,
  });

  if (!trackable.data) {
    return (
      <p className="text-ink-subtle">
        {trackable.isError
          ? errorMessage(t, trackable.error)
          : t('admin.common.loading')}
      </p>
    );
  }
  const tr = trackable.data;
  const isMentee = me.id === tr.menteeId;
  // Newest first, as the API sends them.
  const open = [...tr.openCycles].reverse();

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <Link
            to="/people/$id"
            params={{ id: tr.mentee.id }}
            className="text-sm text-primary hover:text-primary-hover"
          >
            {tr.mentee.name}
          </Link>
          <h1 className="text-3xl font-bold text-navy">{tr.name}</h1>
          {tr.goal && <p className="text-[15px] text-ink-muted">{tr.goal}</p>}
          <p className="text-[13px] text-ink-subtle">
            {t(`trackables.cycles.${tr.cycle}`)} ·{' '}
            {t(`trackables.types.${tr.type}`)} ·{' '}
            {tr.higherIsBetter
              ? t('trackables.higherBetter')
              : t('trackables.lowerBetter')}
            {tr.target !== null && (
              <>
                {' '}
                ·{' '}
                {t('trackables.of', {
                  target: formatNumber(tr.target, i18n.language),
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tr.archivedAt ? (
            <Badge>{t('trackables.archived')}</Badge>
          ) : (
            <TrendBadge trend={tr.trend} />
          )}
          {tr.canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                {t('trackables.edit')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => archive.mutate(!tr.archivedAt)}
                disabled={archive.isPending}
              >
                {tr.archivedAt
                  ? t('trackables.restore')
                  : t('trackables.archive')}
              </Button>
            </>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-6">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="flex items-baseline gap-2">
            <span className="text-sm text-ink-subtle">
              {t('trackables.latest')}
            </span>
            <span className="font-figures text-3xl font-semibold text-navy">
              {tr.latest === null ? '—' : formatValue(tr.latest, tr.type)}
            </span>
          </span>
          <span className="text-sm text-ink-subtle">
            {t('trackables.stats', { logged: tr.logged, missed: tr.missed })}
            {tr.rate !== null && (
              <>
                {' '}
                · {t('trackables.rate', { percent: Math.round(tr.rate * 100) })}
              </>
            )}
          </span>
        </div>
        {tr.points.length > 1 ? (
          <Sparkline
            points={tr.points}
            target={tr.target}
            trend={tr.trend}
            height={140}
            label={t('trackables.chart', {
              trend: t(`trackables.trend.${tr.trend}`),
            })}
          />
        ) : (
          tr.logged === 0 && (
            <p className="text-sm text-ink-subtle">
              {t('trackables.noEntries')}
            </p>
          )
        )}
      </section>

      {tr.canLog && open.length > 0 && (
        <section
          aria-labelledby="to-log-title"
          className="flex flex-col gap-3 rounded-card border-2 border-primary/30 bg-card p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="to-log-title" className="text-lg font-bold text-navy">
              {t('trackables.toLog')}
            </h2>
            <span className="text-[13px] text-ink-subtle">
              {t('trackables.toLogHint')}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-divider">
            {open.map((start) => (
              <li key={start} className="py-3 first:pt-0 last:pb-0">
                <CycleForm
                  trackable={tr}
                  periodStart={start}
                  isMentee={isMentee}
                  onSaved={setTrackable}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="history-title"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-6"
      >
        <h2 id="history-title" className="text-lg font-bold text-navy">
          {t('trackables.history')}
        </h2>
        {tr.entries.length === 0 && (
          <p className="text-sm text-ink-subtle">{t('trackables.noEntries')}</p>
        )}
        <ol className="flex flex-col divide-y divide-divider">
          {tr.entries.map((e) => (
            <Entry
              key={e.id}
              trackable={tr}
              entry={e}
              isMentee={isMentee}
              onSaved={setTrackable}
            />
          ))}
        </ol>
      </section>
      {tr.canManage && <TemplateCard trackable={tr} />}
      {tr.canManage && (
        <TrackableDialog
          menteeId={tr.menteeId}
          trackable={tr}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </>
  );
}

/** Logs (or re-logs) one cycle, with an input that fits the type. */
function CycleForm({
  trackable: tr,
  periodStart,
  entry,
  isMentee,
  onSaved,
  onCancel,
}: {
  trackable: TrackableDetailDto;
  periodStart: string;
  entry?: TrackableEntryDto;
  isMentee: boolean;
  onSaved: (tr: TrackableDetailDto) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const cycleLabel = useCycleLabel();
  const [value, setValue] = useState(entry ? String(entry.value) : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [needsHelp, setNeedsHelp] = useState(entry?.needsHelp ?? false);
  const log = useMutation({
    mutationFn: async (v: number) =>
      (
        await trackablesControllerLog(tr.id, periodStart, {
          value: v,
          note: note || null,
          needsHelp,
        })
      ).data as TrackableDetailDto,
    onSuccess: (next) => {
      toast(t('trackables.logged'));
      onSaved(next);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() !== '' && Number.isFinite(Number(value)))
      log.mutate(Number(value));
  };
  const label = cycleLabel(periodStart, tr.cycle);
  const current = periodStart === tr.currentCycle;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-40 font-semibold text-navy">
          {label}
          {current && (
            <Badge tone="primary" className="ms-2">
              {t('trackables.thisCycle')}
            </Badge>
          )}
        </span>
        {tr.type === 'BOOLEAN' ? (
          <div
            role="group"
            aria-label={`${label} · ${t('trackables.value')}`}
            className="flex gap-2"
          >
            {[1, 0].map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={value === String(v) ? 'primary' : 'outline'}
                aria-pressed={value === String(v)}
                onClick={() => setValue(String(v))}
              >
                {v ? t('trackables.done') : t('trackables.notDone')}
              </Button>
            ))}
          </div>
        ) : (
          <Input
            type="number"
            min={0}
            max={tr.type === 'PERCENTAGE' ? 100 : undefined}
            step="any"
            dir="ltr"
            aria-label={`${label} · ${t('trackables.value')}`}
            className="h-10 w-28 text-center font-figures text-[15px]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <Input
          aria-label={`${label} · ${t('trackables.note')}`}
          placeholder={t('trackables.note')}
          className="h-10 min-w-48 flex-1 text-[15px]"
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
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t('admin.common.cancel')}
          </Button>
        )}
      </div>
      {isMentee && (
        <Checkbox
          id={`help-${periodStart}`}
          label={t('trackables.askHelp')}
          checked={needsHelp}
          onChange={(e) => setNeedsHelp(e.target.checked)}
        />
      )}
      <FormError
        message={log.isError ? errorMessage(t, log.error) : undefined}
      />
    </form>
  );
}

function Entry({
  trackable: tr,
  entry,
  isMentee,
  onSaved,
}: {
  trackable: TrackableDetailDto;
  entry: TrackableEntryDto;
  isMentee: boolean;
  onSaved: (tr: TrackableDetailDto) => void;
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const formatValue = useFormatValue();
  const cycleLabel = useCycleLabel();
  const [body, setBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const reply = useMutation({
    mutationFn: async () =>
      (await trackablesControllerReply(entry.id, { body }))
        .data as TrackableDetailDto,
    onSuccess: (next) => {
      setBody('');
      setReplying(false);
      onSaved(next);
    },
  });
  const date = (iso: string) =>
    formatDate(new Date(iso), {
      locale: i18n.language as Language,
      calendar: me.calendar,
    });
  // The mentee re-logs within the fill window (BR-TRK-4); the mentor any time.
  const canEdit =
    tr.canLog &&
    (!isMentee ||
      cycleEnd(entry.periodStart, tr.cycle) >=
        addDays(toZoned(new Date()).date, -FILL_WINDOW_DAYS));

  if (editing) {
    return (
      <li className="py-4">
        <CycleForm
          trackable={tr}
          periodStart={entry.periodStart}
          entry={entry}
          isMentee={isMentee}
          onSaved={(next) => {
            setEditing(false);
            onSaved(next);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-40 font-semibold text-navy">
          {cycleLabel(entry.periodStart, tr.cycle)}
        </span>
        <span
          className={cn(
            'font-figures text-xl font-semibold',
            tr.type === 'BOOLEAN' && entry.value < 1
              ? 'text-trend-down'
              : 'text-navy',
          )}
        >
          {formatValue(entry.value, tr.type)}
        </span>
        <span className="text-[13px] text-ink-subtle">
          {entry.source === 'MENTEE'
            ? t('trackables.fromMentee')
            : t('trackables.fromMentor')}{' '}
          · {actedBy(t, entry.author, entry.impersonator)} ·{' '}
          {date(entry.recordedAt)}
        </span>
        {entry.needsHelp && (
          <Badge tone="warn">
            <LifeBuoy className="me-1 size-3.5" aria-hidden />
            {t('trackables.needsHelp')}
          </Badge>
        )}
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="ms-auto"
            onClick={() => setEditing(true)}
          >
            {t('trackables.edit')}
          </Button>
        )}
      </div>
      {entry.note && (
        <p className="whitespace-pre-line text-[15px]">{entry.note}</p>
      )}
      {entry.replies.map((r) => (
        <div
          key={r.id}
          className="ms-6 rounded-lg border-s-4 border-primary/40 bg-primary-tint/40 px-3 py-2"
        >
          <p className="text-[13px] text-ink-subtle">
            {actedBy(t, r.author, r.impersonator)} · {date(r.createdAt)}
          </p>
          <p className="whitespace-pre-line text-[15px]">{r.body}</p>
        </div>
      ))}
      {tr.canManage &&
        entry.source === 'MENTEE' &&
        (replying ? (
          <form
            className="ms-6 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) reply.mutate();
            }}
          >
            <Textarea
              aria-label={t('trackables.reply')}
              rows={2}
              placeholder={t('trackables.replyPlaceholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              autoFocus
            />
            <FormError
              message={reply.isError ? errorMessage(t, reply.error) : undefined}
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={!body.trim() || reply.isPending}
              >
                {t('trackables.sendReply')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setReplying(false)}
              >
                {t('admin.common.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => setReplying(true)}
          >
            {t('trackables.reply')}
          </Button>
        ))}
    </li>
  );
}
