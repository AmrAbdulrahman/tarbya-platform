import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  settingsControllerGet,
  settingsControllerUpdate,
  type SettingsDto,
  type SignInRole,
} from '@tarbya/api-client';
import { SIGN_IN_ROLES } from '@tarbya/shared';
import { Button, Checkbox, Input } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { Field, FormError } from '../../../components/login/fields';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { PageHeader } from '../../../components/page-header';

/** US-3.6 */
export const Route = createFileRoute('/_app/admin/settings')({
  component: SettingsPage,
});

const int = (min: number, max: number) =>
  z
    .number({ error: 'validation.number' })
    .int('validation.number')
    .min(min, 'validation.number')
    .max(max, 'validation.number');

const schema = z
  .object({
    signInRoles: z.array(z.enum(SIGN_IN_ROLES)),
    contactDueDays: int(1, 90),
    contactLateDays: int(2, 180),
    rsvpRequestHours: int(1, 336),
    reminderHours: int(1, 72),
    trendWindow: int(2, 10),
    // Shown and edited as a percentage; stored as a fraction.
    trendSteadyPercent: z
      .number({ error: 'validation.number' })
      .min(0, 'validation.number')
      .max(50, 'validation.number'),
  })
  .refine((v) => v.contactLateDays > v.contactDueDays, {
    path: ['contactLateDays'],
    message: 'validation.lateAfterDue',
  });
type Values = z.infer<typeof schema>;

const toValues = (s: SettingsDto): Values => ({
  signInRoles: s.signInRoles,
  contactDueDays: s.contactDueDays,
  contactLateDays: s.contactLateDays,
  rsvpRequestHours: s.rsvpRequestHours,
  reminderHours: s.reminderHours,
  trendWindow: s.trendWindow,
  trendSteadyPercent: Math.round(s.trendSteadyBand * 1000) / 10,
});

function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async ({ signal }) =>
      (await settingsControllerGet({ signal })).data as SettingsDto,
  });
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { errors, isDirty } = form.formState;

  useEffect(() => {
    if (settings.data) form.reset(toValues(settings.data));
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: async ({ trendSteadyPercent, ...v }: Values) =>
      (
        await settingsControllerUpdate({
          ...v,
          trendSteadyBand: trendSteadyPercent / 100,
        })
      ).data as SettingsDto,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      form.reset(toValues(data));
    },
  });

  const err = (name: keyof Values) =>
    errors[name]?.message
      ? t(errors[name]?.message as 'validation.number')
      : undefined;
  const number = (
    name: Exclude<keyof Values, 'signInRoles'>,
    step?: string,
  ) => (
    <Input
      id={`s-${name}`}
      type="number"
      inputMode="decimal"
      step={step}
      dir="ltr"
      className="h-11 max-w-40 font-figures text-[15px]"
      aria-invalid={!!errors[name]}
      {...form.register(name, { valueAsNumber: true })}
    />
  );

  if (!settings.data) {
    return (
      <p className="text-ink-subtle">
        {settings.isError
          ? errorMessage(t, settings.error)
          : t('admin.common.loading')}
      </p>
    );
  }

  return (
    <>
      <Breadcrumbs
        items={[{ label: t('nav.admin') }, { label: t('nav.settings') }]}
      />
      <PageHeader>
        <h1 className="text-2xl font-bold text-brand">
          {t('admin.settings.title')}
        </h1>
        <p className="text-[15px] text-ink-subtle">
          {t('admin.settings.lead')}
        </p>
      </PageHeader>
      <form
        noValidate
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
        className="flex max-w-3xl flex-col gap-5"
      >
        <Section
          title={t('admin.settings.signIn')}
          hint={t('admin.settings.signInHint')}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {SIGN_IN_ROLES.map((role) => (
              <Checkbox
                key={role}
                id={`s-role-${role}`}
                value={role}
                label={t(`admin.roles.${role as SignInRole}`)}
                {...form.register('signInRoles')}
              />
            ))}
          </div>
        </Section>
        <Section title={t('admin.settings.contact')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="s-contactDueDays"
              label={t('admin.settings.dueDays')}
              error={err('contactDueDays')}
            >
              {number('contactDueDays')}
            </Field>
            <Field
              id="s-contactLateDays"
              label={t('admin.settings.lateDays')}
              error={err('contactLateDays')}
            >
              {number('contactLateDays')}
            </Field>
          </div>
        </Section>
        <Section title={t('admin.settings.gatherings')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="s-rsvpRequestHours"
              label={t('admin.settings.rsvpRequestHours')}
              error={err('rsvpRequestHours')}
            >
              {number('rsvpRequestHours')}
            </Field>
            <Field
              id="s-reminderHours"
              label={t('admin.settings.reminderHours')}
              error={err('reminderHours')}
            >
              {number('reminderHours')}
            </Field>
          </div>
        </Section>
        <Section
          title={t('admin.settings.plans')}
          hint={t('admin.settings.trendHint')}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="s-trendWindow"
              label={t('admin.settings.trendWindow')}
              error={err('trendWindow')}
            >
              {number('trendWindow')}
            </Field>
            <Field
              id="s-trendSteadyPercent"
              label={t('admin.settings.trendSteadyBand')}
              error={err('trendSteadyPercent')}
            >
              {number('trendSteadyPercent', '0.5')}
            </Field>
          </div>
        </Section>

        <FormError
          message={save.isError ? errorMessage(t, save.error) : undefined}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending || !isDirty}>
            {t('admin.common.save')}
          </Button>
          {save.isSuccess && !isDirty && (
            <span role="status" className="text-sm font-medium text-trend-up">
              {t('admin.common.saved')}
            </span>
          )}
        </div>
      </form>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-col gap-1">
        <h2 aria-hidden className="text-base font-bold text-brand">
          {title}
        </h2>
        {hint && <p className="text-sm text-ink-subtle">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}
