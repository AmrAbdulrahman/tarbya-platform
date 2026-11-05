import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Pencil, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  gatheringsControllerAttendance,
  gatheringsControllerGet,
  gatheringsControllerRemind,
  gatheringsControllerUpdate,
  type GatheringDto,
  type GatheringRowDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatTime } from '@tarbya/shared';
import { Badge, Button, cn, Input, useToast } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { FormError } from '../login/fields';
import { Avatar } from '../profile/avatar';
import { EditGatheringDialog } from './group-dialogs';
import {
  dayOf,
  gatheringQueryKey,
  gatheringTitle,
  isPast,
  typeName,
} from './format';
import { RsvpButtons } from './rsvp-buttons';

const rsvpTone = {
  ATTENDING: 'success',
  NOT_ATTENDING: 'warn',
  none: 'neutral',
} as const;

/**
 * One gathering: RSVP counts, the member's own answer, and the attendance log
 * with a note per member (BR-GRP-7, BR-GRP-8; design/screens/Group.dc.html).
 */
export function GatheringPanel({ gatheringId }: { gatheringId: string }) {
  const { t } = useTranslation();
  const gathering = useQuery({
    queryKey: gatheringQueryKey(gatheringId),
    queryFn: async ({ signal }) =>
      (await gatheringsControllerGet(gatheringId, { signal }))
        .data as GatheringDto,
  });
  if (!gathering.data) {
    return (
      <section className="rounded-card border border-border bg-card p-5 text-ink-subtle">
        {gathering.isError
          ? errorMessage(t, gathering.error)
          : t('admin.common.loading')}
      </section>
    );
  }
  // Remount per gathering so the attendance form starts from its saved rows.
  return <Panel key={gathering.data.id} g={gathering.data} />;
}

function Panel({ g }: { g: GatheringDto }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const past = isPast(g);
  const cancelled = !!g.cancelledAt;

  const refresh = (data?: GatheringDto) => {
    if (data) queryClient.setQueryData(gatheringQueryKey(g.id), data);
    return Promise.all(
      [
        ['groups', g.groupId],
        ['group-gatherings', g.groupId],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  };
  const toggleCancel = useMutation({
    mutationFn: () =>
      gatheringsControllerUpdate(g.id, { cancelled: !cancelled }),
    onSuccess: (res) => refresh(res.data as GatheringDto),
  });
  const remind = useMutation({
    mutationFn: () => gatheringsControllerRemind(g.id),
    onSuccess: async (res) => {
      toast(t('groups.reminded', { count: res.data.notified }));
      await queryClient.invalidateQueries({
        queryKey: gatheringQueryKey(g.id),
      });
    },
  });

  const stats = [
    ['attending', g.counts.attending, 'text-trend-up'],
    ['notAttending', g.counts.notAttending, 'text-warn'],
    ['noReply', g.counts.noReply, 'text-ink-muted'],
  ] as const;

  return (
    <section
      aria-labelledby="gathering-title"
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-1">
          <h2
            id="gathering-title"
            className="flex flex-wrap items-center gap-2 text-lg font-bold text-brand"
          >
            {gatheringTitle(g, locale)} — {dayOf(g.startsAt, locale)}{' '}
            {formatDate(g.startsAt, { locale, calendar: me.calendar })}
            {cancelled && <Badge tone="danger">{t('groups.cancelled')}</Badge>}
          </h2>
          <p className="text-[15px] text-ink-subtle">
            <bdi>{formatTime(g.startsAt, { locale })}</bdi>
            {g.place && <> · {g.place}</>} · {typeName(g.activityType, locale)}
          </p>
        </div>
        {g.canManage && !past && (
          <div className="flex flex-wrap gap-2">
            {!cancelled && g.activityType.requiresRsvp && (
              <Button
                variant="outline"
                size="sm"
                disabled={remind.isPending || g.counts.noReply === 0}
                onClick={() => remind.mutate()}
              >
                <BellRing aria-hidden />
                {t('groups.remindNoReply')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
              {t('groups.editGathering')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toggleCancel.isPending}
              onClick={() => toggleCancel.mutate()}
            >
              {cancelled ? <RotateCcw aria-hidden /> : <XCircle aria-hidden />}
              {cancelled
                ? t('groups.restoreGathering')
                : t('groups.cancelGathering')}
            </Button>
          </div>
        )}
      </div>
      <FormError
        message={
          toggleCancel.isError || remind.isError
            ? errorMessage(t, toggleCancel.error ?? remind.error)
            : undefined
        }
      />

      {g.isMember && !past && !cancelled && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-3">
          <span className="text-[15px] font-semibold text-brand">
            {t('groups.askRsvp')}
          </span>
          <RsvpButtons gatheringId={g.id} value={g.myRsvp} />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([key, value, color]) => (
          <div key={key} className="rounded-lg bg-surface px-4 py-3">
            <dt className="text-[13px] text-ink-subtle">
              {t(`groups.stats.${key}`)}
            </dt>
            <dd className={cn('font-figures text-2xl font-bold', color)}>
              {value}
            </dd>
          </div>
        ))}
        <div className="rounded-lg bg-primary-tint px-4 py-3">
          <dt className="text-[13px] text-ink-subtle">
            {t('groups.stats.present')}
          </dt>
          <dd className="font-figures text-2xl font-bold text-primary-hover">
            <span dir="ltr">
              {g.counts.present ?? '—'}
              <span className="text-base font-medium text-ink-subtle">
                /{g.counts.members}
              </span>
            </span>
          </dd>
        </div>
      </dl>

      {g.canManage ? (
        <AttendanceForm g={g} onSaved={refresh} />
      ) : (
        <AttendanceTable rows={g.rows} />
      )}

      {editing && (
        <EditGatheringDialog
          gathering={g}
          open={editing}
          onOpenChange={setEditing}
          onSaved={refresh}
        />
      )}
    </section>
  );
}

function RsvpBadge({ row }: { row: GatheringRowDto }) {
  const { t } = useTranslation();
  const key = row.rsvp ?? 'none';
  return <Badge tone={rsvpTone[key]}>{t(`groups.rsvp.${key}`)}</Badge>;
}

function MemberCell({ row }: { row: GatheringRowDto }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <Avatar
        name={row.member.name}
        url={row.member.avatarUrl}
        className="size-8"
      />
      <span className="flex flex-col">
        <span className="font-medium">{row.member.name}</span>
        {row.role !== 'MEMBER' && (
          <span className="text-xs text-ink-subtle">
            {t(`groups.role.${row.role}`)}
          </span>
        )}
      </span>
    </div>
  );
}

/** Read-only for members and the manager chain (BR-GRP-4). */
function AttendanceTable({ rows }: { rows: GatheringRowDto[] }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[15px]">
        <thead className="text-[13px] text-ink-subtle">
          <tr>
            {(['member', 'rsvp', 'present', 'note'] as const).map((c) => (
              <th key={c} scope="col" className="py-2 text-start font-semibold">
                {t(`groups.column.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.member.id} className="border-t border-divider">
              <td className="py-2.5">
                <MemberCell row={r} />
              </td>
              <td className="py-2.5">
                <RsvpBadge row={r} />
              </td>
              <td className="py-2.5 text-ink-muted">
                {r.present === null
                  ? '—'
                  : r.present
                    ? t('feed.present')
                    : t('feed.absent')}
              </td>
              <td className="py-2.5 text-ink-muted">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pre-filled from RSVPs until attendance is taken (US-6.6). */
function AttendanceForm({
  g,
  onSaved,
}: {
  g: GatheringDto;
  onSaved: (data: GatheringDto) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState(() =>
    g.rows.map((r) => ({
      userId: r.member.id,
      present: r.present ?? r.rsvp === 'ATTENDING',
      note: r.note ?? '',
    })),
  );
  const save = useMutation({
    mutationFn: () => gatheringsControllerAttendance(g.id, { rows }),
    onSuccess: async (res) => {
      await onSaved(res.data as GatheringDto);
      toast(t('groups.attendanceSaved'));
    },
  });
  const set = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[15px]">
          <thead className="text-[13px] text-ink-subtle">
            <tr>
              {(['member', 'rsvp', 'present', 'note'] as const).map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    'py-2 text-start font-semibold',
                    c === 'present' && 'w-16 text-center',
                  )}
                >
                  {t(`groups.column.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.rows.map((r, i) => (
              <tr key={r.member.id} className="border-t border-divider">
                <td className="py-2.5 pe-3">
                  <MemberCell row={r} />
                </td>
                <td className="py-2.5 pe-3">
                  <RsvpBadge row={r} />
                </td>
                <td className="py-2.5 text-center">
                  <input
                    type="checkbox"
                    className="size-[18px] cursor-pointer accent-primary"
                    aria-label={t('groups.presentLabel', {
                      name: r.member.name,
                    })}
                    checked={rows[i].present}
                    onChange={(e) => set(i, { present: e.target.checked })}
                  />
                </td>
                <td className="py-2.5 ps-3">
                  <Input
                    className="h-9 text-sm"
                    maxLength={300}
                    aria-label={t('groups.noteLabel', { name: r.member.name })}
                    value={rows[i].note}
                    onChange={(e) => set(i, { note: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormError
        message={save.isError ? errorMessage(t, save.error) : undefined}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending || !rows.length}>
          {t('groups.saveAttendance')}
        </Button>
        {g.counts.present === null && (
          <span className="text-sm text-ink-subtle">
            {t('groups.notTaken')}
          </span>
        )}
      </div>
    </form>
  );
}
