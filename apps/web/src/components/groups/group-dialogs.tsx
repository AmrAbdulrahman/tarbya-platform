import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  gatheringsControllerStopSeries,
  gatheringsControllerUpdate,
  gatheringsControllerUpdateSeries,
  groupsControllerAddMember,
  groupsControllerCreate,
  groupsControllerCreateActivityType,
  groupsControllerCreateGathering,
  groupsControllerCreateSeries,
  groupsControllerRemoveMember,
  groupsControllerSetAdmin,
  groupsControllerSetRole,
  type AssignableGroupRole,
  type GatheringDto,
  type GroupDto,
  type LookupColor,
  type SeriesDto,
  type UserRefDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { fromZoned, toZoned } from '@tarbya/shared';
import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Select,
  Textarea,
} from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { UserPicker } from '../admin/user-picker';
import { Field, FormError } from '../login/fields';
import { Avatar } from '../profile/avatar';
import {
  gatheringQueryKey,
  groupQueryKey,
  typeName,
  weekdayName,
} from './format';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Shell({
  title,
  description,
  open,
  onOpenChange,
  children,
}: DialogProps & { title: string; description?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        closeLabel={t('admin.common.close')}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Actions({
  pending,
  label,
  onCancel,
  disabled,
}: {
  pending: boolean;
  label: string;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={pending || disabled}>
        {label}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {t('groups.cancel')}
      </Button>
    </div>
  );
}

/** Keeps the group page in step after a change: the group, its gatherings and the list. */
function useGroupRefresh(groupId: string) {
  const queryClient = useQueryClient();
  return (data?: GroupDto) => {
    if (data) queryClient.setQueryData(groupQueryKey(groupId), data);
    return Promise.all(
      [['groups'], ['group-gatherings', groupId]].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  };
}

/** US-6.1: a moderator creates a group and assigns its admin (BR-GRP-1). */
export function CreateGroupDialog(props: DialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [admin, setAdmin] = useState<UserRefDto | null>(null);
  const create = useMutation({
    mutationFn: () =>
      groupsControllerCreate({
        name,
        description: description || null,
        adminId: admin?.id ?? '',
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      props.onOpenChange(false);
      await navigate({ to: '/groups/$id', params: { id: res.data.id } });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && admin) create.mutate();
  };
  return (
    <Shell title={t('groups.new')} {...props}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id={`${id}-name`} label={t('groups.field.name')}>
          <Input
            id={`${id}-name`}
            maxLength={120}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id={`${id}-desc`} label={t('groups.field.description')}>
          <Textarea
            id={`${id}-desc`}
            maxLength={500}
            className="min-h-16"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field id={`${id}-admin`} label={t('groups.field.admin')}>
          <UserPicker id={`${id}-admin`} value={admin} onChange={setAdmin} />
        </Field>
        <FormError
          message={create.isError ? errorMessage(t, create.error) : undefined}
        />
        <Actions
          pending={create.isPending}
          disabled={!name.trim() || !admin}
          label={t('groups.create')}
          onCancel={() => props.onOpenChange(false)}
        />
      </form>
    </Shell>
  );
}

/** US-6.2: add a member, or (for the group admin) a group moderator. */
export function AddMemberDialog({
  group,
  ...props
}: DialogProps & { group: GroupDto }) {
  const { t } = useTranslation();
  const id = useId();
  const refresh = useGroupRefresh(group.id);
  const [person, setPerson] = useState<UserRefDto | null>(null);
  const [role, setRole] = useState<AssignableGroupRole>('MEMBER');
  const add = useMutation({
    mutationFn: () =>
      groupsControllerAddMember(group.id, { userId: person?.id ?? '', role }),
    onSuccess: async (res) => {
      await refresh(res.data as GroupDto);
      setPerson(null);
      props.onOpenChange(false);
    },
  });
  return (
    <Shell
      title={t('groups.addMember')}
      description={t('groups.memberHint')}
      {...props}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (person) add.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <Field id={`${id}-person`} label={t('groups.field.person')}>
          <UserPicker
            id={`${id}-person`}
            value={person}
            onChange={setPerson}
            excludeIds={group.members.map((m) => m.id)}
            autoFocus
          />
        </Field>
        {group.canManageRoles && (
          <Field id={`${id}-role`} label={t('groups.field.role')}>
            <Select
              id={`${id}-role`}
              value={role}
              onChange={(e) => setRole(e.target.value as AssignableGroupRole)}
            >
              <option value="MEMBER">{t('groups.role.MEMBER')}</option>
              <option value="MODERATOR">{t('groups.role.MODERATOR')}</option>
            </Select>
          </Field>
        )}
        <FormError
          message={add.isError ? errorMessage(t, add.error) : undefined}
        />
        <Actions
          pending={add.isPending}
          disabled={!person}
          label={t('groups.add')}
          onCancel={() => props.onOpenChange(false)}
        />
      </form>
    </Shell>
  );
}

/** BR-GRP-2: roles, removal, and handing over the admin role. */
export function RolesDialog({
  group,
  ...props
}: DialogProps & { group: GroupDto }) {
  const { t } = useTranslation();
  const id = useId();
  const refresh = useGroupRefresh(group.id);
  const [next, setNext] = useState<UserRefDto | null>(null);
  const onDone = (res: { data: unknown }) => refresh(res.data as GroupDto);
  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: AssignableGroupRole }) =>
      groupsControllerSetRole(group.id, v.userId, { role: v.role }),
    onSuccess: onDone,
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      groupsControllerRemoveMember(group.id, userId),
    onSuccess: onDone,
  });
  const handover = useMutation({
    mutationFn: () =>
      groupsControllerSetAdmin(group.id, { userId: next?.id ?? '' }),
    onSuccess: async (res) => {
      setNext(null);
      await onDone(res);
    },
  });
  const failed = setRole.error ?? remove.error ?? handover.error;

  return (
    <Shell title={t('groups.manageRoles')} {...props}>
      <ul className="flex flex-col divide-y divide-border">
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={m.name} url={m.avatarUrl} className="size-8" />
            <span className="flex-1 font-medium">{m.name}</span>
            {m.role === 'ADMIN' ? (
              <span className="text-sm font-semibold text-brand">
                {t('groups.role.ADMIN')}
              </span>
            ) : (
              <>
                <div className="w-40">
                  <Select
                    aria-label={t('groups.roleOf', { name: m.name })}
                    className="h-9 text-sm"
                    value={m.role}
                    disabled={setRole.isPending}
                    onChange={(e) =>
                      setRole.mutate({
                        userId: m.id,
                        role: e.target.value as AssignableGroupRole,
                      })
                    }
                  >
                    <option value="MEMBER">{t('groups.role.MEMBER')}</option>
                    <option value="MODERATOR">
                      {t('groups.role.MODERATOR')}
                    </option>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={t('groups.removeLabel', { name: m.name })}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(m.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (next) handover.mutate();
        }}
        className="flex flex-col gap-2 rounded-card bg-surface p-4"
      >
        <Field id={`${id}-handover`} label={t('groups.handover')}>
          <UserPicker
            id={`${id}-handover`}
            value={next}
            onChange={setNext}
            excludeIds={group.admin ? [group.admin.id] : []}
          />
        </Field>
        <p className="text-[13px] text-ink-subtle">
          {t('groups.handoverHint')}
        </p>
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={!next || handover.isPending}
          >
            {t('groups.handoverAction')}
          </Button>
        </div>
      </form>
      <FormError message={failed ? errorMessage(t, failed) : undefined} />
    </Shell>
  );
}

/** US-6.3: a weekly (or every few weeks) gathering; also edits and stops one. */
export function SeriesDialog({
  group,
  series,
  ...props
}: DialogProps & { group: GroupDto; series?: SeriesDto }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const id = useId();
  const refresh = useGroupRefresh(group.id);
  const types = group.activityTypes.filter(
    (x) => x.scope === 'GROUP_RECURRING',
  );
  const [v, setV] = useState({
    activityTypeId: series?.activityType.id ?? types[0]?.id ?? '',
    title: series?.title ?? '',
    weekday: series?.weekday ?? 2,
    time: series?.time ?? '20:00',
    intervalWeeks: series?.intervalWeeks ?? 1,
    place: series?.place ?? '',
    startsOn: series?.startsOn ?? toZoned(new Date()).date,
  });
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...v, title: v.title || null, place: v.place || null };
      return series
        ? gatheringsControllerUpdateSeries(series.id, body)
        : groupsControllerCreateSeries(group.id, body);
    },
    onSuccess: async () => {
      await refresh();
      props.onOpenChange(false);
    },
  });
  const stop = useMutation({
    mutationFn: () => gatheringsControllerStopSeries(series?.id ?? ''),
    onSuccess: async () => {
      await refresh();
      props.onOpenChange(false);
    },
  });
  const failed = save.error ?? stop.error;

  return (
    <Shell
      title={series ? t('groups.editSeries') : t('groups.newSeries')}
      {...props}
    >
      {types.length === 0 ? (
        <p className="text-ink-subtle">{t('groups.noRecurringTypes')}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field id={`${id}-type`} label={t('groups.field.gatheringType')}>
            <Select
              id={`${id}-type`}
              value={v.activityTypeId}
              onChange={(e) => set({ activityTypeId: e.target.value })}
            >
              {types.map((x) => (
                <option key={x.id} value={x.id}>
                  {typeName(x, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-title`} label={t('groups.field.titleOptional')}>
            <Input
              id={`${id}-title`}
              maxLength={120}
              value={v.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={`${id}-day`} label={t('groups.field.weekday')}>
              <Select
                id={`${id}-day`}
                value={v.weekday}
                onChange={(e) => set({ weekday: Number(e.target.value) })}
              >
                {[6, 0, 1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {weekdayName(d, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`${id}-time`} label={t('groups.field.time')}>
              <Input
                id={`${id}-time`}
                type="time"
                required
                value={v.time}
                onChange={(e) => set({ time: e.target.value })}
              />
            </Field>
            <Field id={`${id}-interval`} label={t('groups.field.interval')}>
              <Select
                id={`${id}-interval`}
                value={v.intervalWeeks}
                onChange={(e) => set({ intervalWeeks: Number(e.target.value) })}
              >
                {([1, 2, 3, 4] as const).map((n) => (
                  <option key={n} value={n}>
                    {t(`groups.interval.w${n}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-place`} label={t('groups.field.place')}>
              <Input
                id={`${id}-place`}
                maxLength={200}
                value={v.place}
                onChange={(e) => set({ place: e.target.value })}
              />
            </Field>
            <Field id={`${id}-from`} label={t('groups.field.startsOn')}>
              <Input
                id={`${id}-from`}
                type="date"
                required
                value={v.startsOn}
                onChange={(e) => set({ startsOn: e.target.value })}
              />
            </Field>
          </div>
          <FormError message={failed ? errorMessage(t, failed) : undefined} />
          <div className="flex flex-wrap items-center gap-2">
            <Actions
              pending={save.isPending}
              label={series ? t('groups.save') : t('groups.create')}
              onCancel={() => props.onOpenChange(false)}
            />
            {series && (
              <Button
                type="button"
                variant="ghost"
                className="ms-auto text-trend-down"
                title={t('groups.stopSeriesHint')}
                disabled={stop.isPending}
                onClick={() => stop.mutate()}
              >
                {t('groups.stopSeries')}
              </Button>
            )}
          </div>
        </form>
      )}
    </Shell>
  );
}

/** BR-GRP-6: a one-time group activity with an organisation or group type. */
export function OneOffDialog({
  group,
  onCreated,
  ...props
}: DialogProps & { group: GroupDto; onCreated: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const id = useId();
  const refresh = useGroupRefresh(group.id);
  const types = group.activityTypes.filter((x) => x.scope === 'GROUP_ONE_OFF');
  const now = toZoned(new Date());
  const [v, setV] = useState({
    activityTypeId: types[0]?.id ?? '',
    title: '',
    date: now.date,
    time: '18:00',
    place: '',
  });
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const create = useMutation({
    mutationFn: () =>
      groupsControllerCreateGathering(group.id, {
        activityTypeId: v.activityTypeId,
        title: v.title,
        startsAt: fromZoned({ date: v.date, time: v.time }).toISOString(),
        place: v.place || null,
      }),
    onSuccess: async (res) => {
      await refresh();
      props.onOpenChange(false);
      onCreated(res.data.id);
    },
  });
  return (
    <Shell title={t('groups.addOneOff')} {...props}>
      {types.length === 0 ? (
        <p className="text-ink-subtle">{t('groups.noTypes')}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (v.title.trim()) create.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field id={`${id}-type`} label={t('groups.field.activityType')}>
            <Select
              id={`${id}-type`}
              value={v.activityTypeId}
              onChange={(e) => set({ activityTypeId: e.target.value })}
            >
              {types.map((x) => (
                <option key={x.id} value={x.id}>
                  {typeName(x, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-title`} label={t('groups.field.title')}>
            <Input
              id={`${id}-title`}
              maxLength={120}
              required
              value={v.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-date`} label={t('groups.field.date')}>
              <Input
                id={`${id}-date`}
                type="date"
                required
                value={v.date}
                onChange={(e) => set({ date: e.target.value })}
              />
            </Field>
            <Field id={`${id}-time`} label={t('groups.field.time')}>
              <Input
                id={`${id}-time`}
                type="time"
                required
                value={v.time}
                onChange={(e) => set({ time: e.target.value })}
              />
            </Field>
          </div>
          <Field id={`${id}-place`} label={t('groups.field.place')}>
            <Input
              id={`${id}-place`}
              maxLength={200}
              value={v.place}
              onChange={(e) => set({ place: e.target.value })}
            />
          </Field>
          <FormError
            message={create.isError ? errorMessage(t, create.error) : undefined}
          />
          <Actions
            pending={create.isPending}
            disabled={!v.title.trim()}
            label={t('groups.create')}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      )}
    </Shell>
  );
}

const COLORS: LookupColor[] = [
  'PURPLE',
  'NAVY',
  'GREEN',
  'AMBER',
  'ROSE',
  'SLATE',
];

/** BR-GRP-6: the group's own one-time activity types. */
export function GroupTypeDialog({
  group,
  ...props
}: DialogProps & { group: GroupDto }) {
  const { t } = useTranslation();
  const id = useId();
  const refresh = useGroupRefresh(group.id);
  const [v, setV] = useState({
    nameAr: '',
    nameEn: '',
    color: 'PURPLE' as LookupColor,
  });
  const create = useMutation({
    mutationFn: () => groupsControllerCreateActivityType(group.id, v),
    onSuccess: async () => {
      await refresh();
      setV({ nameAr: '', nameEn: '', color: 'PURPLE' });
      props.onOpenChange(false);
    },
  });
  return (
    <Shell title={t('groups.newTypeTitle')} {...props}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-ar`} label={t('groups.field.nameAr')}>
            <Input
              id={`${id}-ar`}
              lang="ar"
              dir="rtl"
              required
              maxLength={80}
              value={v.nameAr}
              onChange={(e) => setV({ ...v, nameAr: e.target.value })}
            />
          </Field>
          <Field id={`${id}-en`} label={t('groups.field.nameEn')}>
            <Input
              id={`${id}-en`}
              lang="en"
              dir="ltr"
              required
              maxLength={80}
              value={v.nameEn}
              onChange={(e) => setV({ ...v, nameEn: e.target.value })}
            />
          </Field>
        </div>
        <Field id={`${id}-color`} label={t('groups.field.color')}>
          <Select
            id={`${id}-color`}
            value={v.color}
            onChange={(e) =>
              setV({ ...v, color: e.target.value as LookupColor })
            }
          >
            {COLORS.map((c) => (
              <option key={c} value={c}>
                {t(`admin.lookups.colors.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <FormError
          message={create.isError ? errorMessage(t, create.error) : undefined}
        />
        <Actions
          pending={create.isPending}
          disabled={!v.nameAr.trim() || !v.nameEn.trim()}
          label={t('groups.create')}
          onCancel={() => props.onOpenChange(false)}
        />
      </form>
    </Shell>
  );
}

/** US-6.3: move or rename one occurrence. */
export function EditGatheringDialog({
  gathering: g,
  onSaved,
  ...props
}: DialogProps & {
  gathering: GatheringDto;
  onSaved: (data: GatheringDto) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const queryClient = useQueryClient();
  const at = toZoned(new Date(g.startsAt));
  const [v, setV] = useState({
    title: g.title ?? '',
    date: at.date,
    time: at.time,
    place: g.place ?? '',
  });
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const save = useMutation({
    mutationFn: () =>
      gatheringsControllerUpdate(g.id, {
        title: v.title || null,
        place: v.place || null,
        startsAt: fromZoned({ date: v.date, time: v.time }).toISOString(),
      }),
    onSuccess: async (res) => {
      queryClient.setQueryData(gatheringQueryKey(g.id), res.data);
      await onSaved(res.data as GatheringDto);
      props.onOpenChange(false);
    },
  });
  return (
    <Shell title={t('groups.editGathering')} {...props}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <Field id={`${id}-title`} label={t('groups.field.titleOptional')}>
          <Input
            id={`${id}-title`}
            maxLength={120}
            value={v.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-date`} label={t('groups.field.date')}>
            <Input
              id={`${id}-date`}
              type="date"
              required
              value={v.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </Field>
          <Field id={`${id}-time`} label={t('groups.field.time')}>
            <Input
              id={`${id}-time`}
              type="time"
              required
              value={v.time}
              onChange={(e) => set({ time: e.target.value })}
            />
          </Field>
        </div>
        <Field id={`${id}-place`} label={t('groups.field.place')}>
          <Input
            id={`${id}-place`}
            maxLength={200}
            value={v.place}
            onChange={(e) => set({ place: e.target.value })}
          />
        </Field>
        <FormError
          message={save.isError ? errorMessage(t, save.error) : undefined}
        />
        <Actions
          pending={save.isPending}
          label={t('groups.save')}
          onCancel={() => props.onOpenChange(false)}
        />
      </form>
    </Shell>
  );
}
