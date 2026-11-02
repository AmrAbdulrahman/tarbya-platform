import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LifeBuoy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  plansControllerCheckIn,
  plansControllerGet,
  plansControllerReply,
  plansControllerUpdate,
  type PlanDetailDto,
  type PlanReadingDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { Badge, Button, Checkbox, Input, Textarea } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { useMe } from '../../../auth/session';
import { FormError } from '../../../components/login/fields';
import { formatNumber } from '../../../components/plans/plan-card';
import { PlanDialog } from '../../../components/plans/plan-dialog';
import { Sparkline, TrendBadge } from '../../../components/plans/trend';

/** A plan with its readings: US-5.2 (check in), US-4.7 (reply) · design/screens/MyPlan.dc.html */
export const Route = createFileRoute('/_app/plans/$id')({
  component: PlanPage,
});

function PlanPage() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const queryKey = ['plans', 'detail', id];
  const plan = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await plansControllerGet(id, { signal })).data as PlanDetailDto,
  });
  const [editing, setEditing] = useState(false);
  const setPlan = (p: PlanDetailDto) => {
    queryClient.setQueryData(queryKey, p);
    void queryClient.invalidateQueries({ queryKey: ['plans', p.menteeId] });
  };
  const toggle = useMutation({
    mutationFn: async (closed: boolean) =>
      (await plansControllerUpdate(id, { closed })).data as PlanDetailDto,
    onSuccess: setPlan,
  });

  if (!plan.data) {
    return (
      <p className="text-ink-subtle">
        {plan.isError ? errorMessage(t, plan.error) : t('admin.common.loading')}
      </p>
    );
  }
  const p = plan.data;
  const tracking =
    i18n.language === 'ar' ? p.trackingMethod.nameAr : p.trackingMethod.nameEn;
  const points = [...p.readings].reverse().map((r) => r.value);

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <Link
            to="/people/$id"
            params={{ id: p.mentee.id }}
            className="text-sm text-primary hover:text-primary-hover"
          >
            {p.mentee.name}
          </Link>
          <h1 className="text-3xl font-bold text-navy">{p.name}</h1>
          <p className="text-[15px] text-ink-muted">{p.goal}</p>
          <p className="text-[13px] text-ink-subtle">
            {tracking} ·{' '}
            {t('plans.of', { target: formatNumber(p.target, i18n.language) })} ·{' '}
            {p.higherIsBetter
              ? t('plans.higherBetter')
              : t('plans.lowerBetter')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.closedAt ? (
            <Badge>{t('plans.closed')}</Badge>
          ) : (
            <TrendBadge trend={p.trend} />
          )}
          {p.canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                {t('plans.edit')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggle.mutate(!p.closedAt)}
                disabled={toggle.isPending}
              >
                {p.closedAt ? t('plans.reopen') : t('plans.close')}
              </Button>
            </>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-ink-subtle">{t('plans.current')}</span>
          <span className="font-figures text-3xl font-semibold text-navy">
            {p.latest === null ? '—' : formatNumber(p.latest, i18n.language)}
          </span>
        </div>
        {points.length > 1 ? (
          <Sparkline
            points={points}
            target={p.target}
            trend={p.trend}
            height={140}
            label={t('plans.chart', { trend: t(`plans.trend.${p.trend}`) })}
          />
        ) : (
          <p className="text-sm text-ink-subtle">
            {p.latest === null ? t('plans.noReadings') : null}
          </p>
        )}
      </section>

      {p.canCheckIn && <CheckInForm plan={p} onSaved={setPlan} />}

      <section
        aria-labelledby="history-title"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-6"
      >
        <h2 id="history-title" className="text-lg font-bold text-navy">
          {t('plans.history')}
        </h2>
        {p.readings.length === 0 && (
          <p className="text-sm text-ink-subtle">{t('plans.noReadings')}</p>
        )}
        <ol className="flex flex-col divide-y divide-divider">
          {p.readings.map((r) => (
            <Reading
              key={r.id}
              reading={r}
              canReply={p.canManage}
              onSaved={setPlan}
            />
          ))}
        </ol>
      </section>
      {p.canManage && (
        <PlanDialog
          menteeId={p.menteeId}
          plan={p}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </>
  );
}

function CheckInForm({
  plan,
  onSaved,
}: {
  plan: PlanDetailDto;
  onSaved: (p: PlanDetailDto) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(
    plan.latest === null ? '' : String(plan.latest),
  );
  const [note, setNote] = useState('');
  const [needsHelp, setNeedsHelp] = useState(false);
  const send = useMutation({
    mutationFn: async () =>
      (
        await plansControllerCheckIn(plan.id, {
          value: Number(value),
          note: note || null,
          needsHelp,
        })
      ).data as PlanDetailDto,
    onSuccess: (p) => {
      setNote('');
      setNeedsHelp(false);
      onSaved(p);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() !== '' && Number.isFinite(Number(value))) send.mutate();
  };
  return (
    <section
      aria-labelledby="checkin-title"
      className="flex flex-col gap-4 rounded-card border-2 border-primary/30 bg-card p-6"
    >
      <h2 id="checkin-title" className="text-lg font-bold text-navy">
        {t('plans.reportTitle')}
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-muted">
          {t('plans.value')}
          <Input
            type="number"
            step="any"
            dir="ltr"
            className="h-12 w-40 font-figures text-xl"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-muted">
          {t('plans.note')}
          <Textarea
            rows={2}
            className="font-normal"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <Checkbox
          id="needs-help"
          label={t('plans.askHelp')}
          checked={needsHelp}
          onChange={(e) => setNeedsHelp(e.target.checked)}
        />
        <FormError
          message={send.isError ? errorMessage(t, send.error) : undefined}
        />
        {send.isSuccess && (
          <p role="status" className="text-sm font-medium text-trend-up">
            {t('plans.sent')}
          </p>
        )}
        <Button
          type="submit"
          className="self-start"
          disabled={send.isPending || value.trim() === ''}
        >
          {t('plans.send')}
        </Button>
      </form>
    </section>
  );
}

function Reading({
  reading,
  canReply,
  onSaved,
}: {
  reading: PlanReadingDto;
  canReply: boolean;
  onSaved: (p: PlanDetailDto) => void;
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const [body, setBody] = useState('');
  const [open, setOpen] = useState(false);
  const reply = useMutation({
    mutationFn: async () =>
      (await plansControllerReply(reading.id, { body })).data as PlanDetailDto,
    onSuccess: (p) => {
      setBody('');
      setOpen(false);
      onSaved(p);
    },
  });
  const date = (iso: string) =>
    formatDate(new Date(iso), {
      locale: i18n.language as Language,
      calendar: me.calendar,
    });

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-figures text-xl font-semibold text-navy">
          {formatNumber(reading.value, i18n.language)}
        </span>
        <span className="text-[13px] text-ink-subtle">
          {date(reading.recordedAt)} ·{' '}
          {reading.source === 'CHECK_IN'
            ? t('plans.checkIn')
            : t('plans.fromFollowUp')}{' '}
          · {reading.author.name}
        </span>
        {reading.needsHelp && (
          <Badge tone="warn">
            <LifeBuoy className="me-1 size-3.5" aria-hidden />
            {t('plans.needsHelp')}
          </Badge>
        )}
      </div>
      {reading.note && (
        <p className="whitespace-pre-line text-[15px]">{reading.note}</p>
      )}
      {reading.replies.map((r) => (
        <div
          key={r.id}
          className="ms-6 rounded-lg border-s-4 border-primary/40 bg-primary-tint/40 px-3 py-2"
        >
          <p className="text-[13px] text-ink-subtle">
            {r.author.name} · {date(r.createdAt)}
          </p>
          <p className="whitespace-pre-line text-[15px]">{r.body}</p>
        </div>
      ))}
      {canReply &&
        reading.source === 'CHECK_IN' &&
        (open ? (
          <form
            className="ms-6 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) reply.mutate();
            }}
          >
            <Textarea
              aria-label={t('plans.reply')}
              rows={2}
              placeholder={t('plans.replyPlaceholder')}
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
                {t('plans.sendReply')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
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
            onClick={() => setOpen(true)}
          >
            {t('plans.reply')}
          </Button>
        ))}
    </li>
  );
}
