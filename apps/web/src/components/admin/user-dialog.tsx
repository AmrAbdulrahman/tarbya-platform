import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  ApiError,
  usersControllerCreate,
  usersControllerDeactivate,
  usersControllerReactivate,
  usersControllerSetManager,
  usersControllerSetModerator,
  usersControllerUpdate,
  type UserDto,
  type UserRefDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  Input,
  Select,
} from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { meQuery, useMe } from '../../auth/session';
import { Field, FormError } from '../login/fields';
import { UserPicker } from './user-picker';

// Messages are i18n keys, translated where they're shown.
const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120),
  email: z.union([z.literal(''), z.email('validation.email')]),
  phone: z.union([
    z.literal(''),
    z.string().regex(/^\+?[0-9][0-9 ()-]{5,19}$/, 'validation.phone'),
  ]),
  locale: z.enum(['ar', 'en']),
  calendar: z.enum(['GREGORIAN', 'HIJRI', 'BOTH']),
  manager: z.custom<UserRefDto | null>(),
  isModerator: z.boolean(),
});
type Values = z.infer<typeof schema>;

interface Props {
  /** Absent to create a new user. */
  user?: UserDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Add or edit a user (US-3.1), their manager (US-3.4) and, for the super admin, moderator status (US-3.2). */
export function UserDialog({ user, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={
          user
            ? t('admin.userForm.editTitle', { name: user.name })
            : t('admin.userForm.createTitle')
        }
        closeLabel={t('admin.common.close')}
      >
        {/* Remount per user so the form starts from their current values. */}
        <UserForm
          key={user?.id ?? 'new'}
          user={user}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function UserForm({ user, onDone }: { user?: UserDto; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const queryClient = useQueryClient();
  const isSuperAdmin = me.roles.includes('SUPER_ADMIN');
  const targetIsSuperAdmin = !!user?.roles.includes('SUPER_ADMIN');
  const canSetModerator = isSuperAdmin && !targetIsSuperAdmin;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      locale: user?.locale ?? 'ar',
      calendar: user?.calendar ?? 'BOTH',
      manager: user?.manager ?? null,
      isModerator: user?.isModerator ?? false,
    },
  });
  const { errors, dirtyFields } = form.formState;
  // Only moderators sit in the management line, so the manager field follows the checkbox.
  const isModerator = form.watch('isModerator');

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      user?.id === me.id &&
        queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
    ]);

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const contact = { email: v.email || null, phone: v.phone || null };
      const fields = {
        name: v.name,
        ...contact,
        locale: v.locale,
        calendar: v.calendar,
      };
      let id = user?.id;
      if (!id) {
        id = ((await usersControllerCreate(fields)).data as UserDto).id;
      } else if (
        dirtyFields.name ||
        dirtyFields.email ||
        dirtyFields.phone ||
        dirtyFields.locale ||
        dirtyFields.calendar
      ) {
        await usersControllerUpdate(id, fields);
      }
      // Moderator status before the manager: only moderators can have one (BR-MGR-1).
      if (canSetModerator && v.isModerator !== (user?.isModerator ?? false)) {
        await usersControllerSetModerator(id, { isModerator: v.isModerator });
      }
      if (
        v.isModerator &&
        (v.manager?.id ?? null) !== (user?.manager?.id ?? null)
      ) {
        await usersControllerSetManager(id, {
          managerId: v.manager?.id ?? null,
        });
      }
    },
    onSuccess: async () => {
      await refresh();
      onDone();
    },
    // A partial save (say the manager was refused) still changed something.
    onSettled: refresh,
    onError: (error) => {
      // Point at the field when the API says which one is wrong.
      const field = error instanceof ApiError && fieldFor[error.code ?? ''];
      if (field) form.setError(field, { message: `errors.${error.code}` });
    },
  });

  const toggleActive = useMutation({
    mutationFn: () =>
      user?.deactivatedAt
        ? usersControllerReactivate(user.id)
        : usersControllerDeactivate(user?.id ?? ''),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });
  const [confirming, setConfirming] = useState(false);

  const fieldError = (name: keyof Values) =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.required')
      : undefined;
  const unhandled =
    save.isError &&
    !(save.error instanceof ApiError && fieldFor[save.error.code ?? ''])
      ? errorMessage(t, save.error)
      : toggleActive.isError
        ? errorMessage(t, toggleActive.error)
        : undefined;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      className="flex flex-col gap-4"
    >
      {targetIsSuperAdmin && (
        <p className="rounded-control bg-surface px-3 py-2.5 text-sm text-ink-muted">
          {t('admin.userForm.superAdminNote')}
        </p>
      )}
      <Field
        id="u-name"
        label={t('admin.userForm.name')}
        error={fieldError('name')}
      >
        <Input
          id="u-name"
          className="h-11 text-[15px]"
          aria-invalid={!!errors.name}
          {...form.register('name')}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="u-email"
          label={t('admin.userForm.email')}
          error={fieldError('email') ?? undefined}
        >
          <Input
            id="u-email"
            type="email"
            dir="ltr"
            className="h-11 text-[15px]"
            disabled={targetIsSuperAdmin}
            aria-invalid={!!errors.email}
            aria-describedby="u-email-hint"
            {...form.register('email')}
          />
          <span id="u-email-hint" className="text-[13px] text-ink-subtle">
            {t('admin.userForm.emailHint')}
          </span>
        </Field>
        <Field
          id="u-phone"
          label={t('admin.userForm.phone')}
          error={fieldError('phone')}
        >
          <Input
            id="u-phone"
            type="tel"
            dir="ltr"
            className="h-11 text-[15px]"
            aria-invalid={!!errors.phone}
            {...form.register('phone')}
          />
        </Field>
        <Field id="u-locale" label={t('admin.userForm.language')}>
          <Select id="u-locale" {...form.register('locale')}>
            {(['ar', 'en'] as const).map((l) => (
              <option key={l} value={l} lang={l}>
                {t(`admin.languages.${l}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="u-calendar" label={t('admin.userForm.calendar')}>
          <Select id="u-calendar" {...form.register('calendar')}>
            {(['GREGORIAN', 'HIJRI', 'BOTH'] as const).map((c) => (
              <option key={c} value={c}>
                {t(`admin.calendars.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {isModerator && (
        <Field
          id="u-manager"
          label={t('admin.userForm.manager')}
          error={fieldError('manager')}
        >
          <Controller
            control={form.control}
            name="manager"
            render={({ field }) => (
              <UserPicker
                id="u-manager"
                value={field.value}
                onChange={field.onChange}
                excludeIds={user ? [user.id] : []}
                invalid={!!errors.manager}
                moderatorsOnly
                describedBy="u-manager-hint"
              />
            )}
          />
          <span id="u-manager-hint" className="text-[13px] text-ink-subtle">
            {t('admin.userForm.managerHint')}
          </span>
        </Field>
      )}
      {canSetModerator && (
        <Checkbox
          id="u-moderator"
          label={t('admin.userForm.moderator')}
          hint={t('admin.userForm.moderatorHint')}
          {...form.register('isModerator')}
        />
      )}

      <FormError message={unhandled} />

      <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-4">
        <Button type="submit" disabled={save.isPending}>
          {t('admin.common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('admin.common.cancel')}
        </Button>
        <div className="flex-1" />
        {user &&
          !targetIsSuperAdmin &&
          user.id !== me.id &&
          (user.deactivatedAt ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
            >
              {t('admin.userForm.reactivate')}
            </Button>
          ) : confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              {t('admin.userForm.deactivateConfirm')}
              <Button
                type="button"
                size="sm"
                className="bg-trend-down hover:bg-trend-down/90"
                onClick={() => toggleActive.mutate()}
                disabled={toggleActive.isPending}
              >
                {t('admin.userForm.deactivate')}
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="text-trend-down"
              onClick={() => setConfirming(true)}
            >
              {t('admin.userForm.deactivate')}
            </Button>
          ))}
      </div>
      {user?.deactivatedAt && (
        <p className="text-sm text-ink-subtle">
          {t('admin.userForm.deactivatedOn', {
            date: formatDate(new Date(user.deactivatedAt), {
              locale: i18n.language as Language,
              calendar: me.calendar,
            }),
          })}
        </p>
      )}
    </form>
  );
}

const fieldFor: Record<string, keyof Values> = {
  USER_EMAIL_TAKEN: 'email',
  USER_PHONE_TAKEN: 'phone',
  MANAGER_CYCLE: 'manager',
  MANAGER_INACTIVE: 'manager',
};
