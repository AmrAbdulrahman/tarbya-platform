import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  lookupsControllerCreateActivityType,
  lookupsControllerUpdateActivityType,
  type ActivityTypeDto,
} from '@tarbya/api-client';
import { Button, Checkbox, cn, Input, Select } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from '../login/fields';
import { lookupColors } from './lookup-colors';

const SCOPES = ['INDIVIDUAL', 'GROUP_RECURRING', 'GROUP_ONE_OFF'] as const;
const COLORS = ['PURPLE', 'NAVY', 'GREEN', 'AMBER', 'ROSE', 'SLATE'] as const;
const REMINDERS = ['NONE', 'H3', 'H24', 'H48'] as const;

const schema = z.object({
  nameAr: z.string().trim().min(1, 'validation.required').max(80),
  nameEn: z.string().trim().min(1, 'validation.required').max(80),
  scope: z.enum(SCOPES),
  color: z.enum(COLORS),
  requiresRsvp: z.boolean(),
  tracksAttendance: z.boolean(),
  showInFeed: z.boolean(),
  reminder: z.enum(REMINDERS),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

// Defaults for a new type match the design's blank form.
const blank: Values = {
  nameAr: '',
  nameEn: '',
  scope: 'GROUP_ONE_OFF',
  color: 'PURPLE',
  requiresRsvp: true,
  tracksAttendance: true,
  showInFeed: true,
  reminder: 'H24',
  active: true,
};

interface Props {
  /** Absent for a new type. */
  type?: ActivityTypeDto;
  onDone: () => void;
}

/** US-3.5 · the editor panel of design/screens/ActivityTypes.dc.html */
export function ActivityTypeEditor({ type, onDone }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: type ?? blank,
  });
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (v: Values) =>
      type
        ? lookupsControllerUpdateActivityType(type.id, v)
        : lookupsControllerCreateActivityType(v),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity-types'] });
      onDone();
    },
  });

  const name = type && (i18n.language === 'ar' ? type.nameAr : type.nameEn);
  const required = (field: 'nameAr' | 'nameEn') =>
    errors[field] ? t('validation.required') : undefined;

  return (
    <form
      noValidate
      aria-label={t('admin.lookups.editor')}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <h2 className="text-base font-bold text-navy">
        {name
          ? t('admin.lookups.editTitle', { name })
          : t('admin.lookups.newTitle')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="at-ar"
          label={t('admin.lookups.nameAr')}
          error={required('nameAr')}
        >
          <Input
            id="at-ar"
            dir="rtl"
            lang="ar"
            className="h-11 text-[15px]"
            aria-invalid={!!errors.nameAr}
            {...form.register('nameAr')}
          />
        </Field>
        <Field
          id="at-en"
          label={t('admin.lookups.nameEn')}
          error={required('nameEn')}
        >
          <Input
            id="at-en"
            dir="ltr"
            lang="en"
            className="h-11 text-[15px]"
            aria-invalid={!!errors.nameEn}
            {...form.register('nameEn')}
          />
        </Field>
      </div>
      <Field id="at-scope" label={t('admin.lookups.scope')}>
        <Select id="at-scope" {...form.register('scope')}>
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.lookups.scopeOptions.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink-muted">
          {t('admin.lookups.color')}
        </legend>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t(`admin.lookups.colors.${c}`)}
                  aria-pressed={field.value === c}
                  onClick={() => field.onChange(c)}
                  style={{ backgroundColor: lookupColors[c].swatch }}
                  className={cn(
                    'size-9 rounded-full ring-2 ring-offset-2',
                    field.value === c ? 'ring-navy' : 'ring-transparent',
                  )}
                />
              ))}
            </div>
          )}
        />
      </fieldset>
      <div className="flex flex-col gap-2.5">
        <Checkbox
          id="at-rsvp"
          label={t('admin.lookups.requiresRsvp')}
          {...form.register('requiresRsvp')}
        />
        <Checkbox
          id="at-att"
          label={t('admin.lookups.tracksAttendance')}
          {...form.register('tracksAttendance')}
        />
        <Checkbox
          id="at-feed"
          label={t('admin.lookups.showInFeed')}
          {...form.register('showInFeed')}
        />
      </div>
      <Field id="at-rem" label={t('admin.lookups.reminder')}>
        <Select id="at-rem" {...form.register('reminder')}>
          {REMINDERS.map((r) => (
            <option key={r} value={r}>
              {t(`admin.lookups.reminders.${r}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox
        id="at-active"
        label={t('admin.lookups.activeLabel')}
        {...form.register('active')}
      />
      <FormError
        message={save.isError ? errorMessage(t, save.error) : undefined}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('admin.common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('admin.common.cancel')}
        </Button>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-subtle">
        {t('admin.lookups.note')}
      </p>
    </form>
  );
}
