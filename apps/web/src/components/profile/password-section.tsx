import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  meControllerChangePassword,
  type MyProfileDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { Button, cn, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from '../login/fields';
import { Section } from './section';

const MIN = 10;

/** 0–4 from length and variety; a guide for the meter, not a rule (the API only checks length). */
export function passwordScore(pw: string): number {
  if (pw.length < MIN) return pw ? 1 : 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((r) =>
    r.test(pw),
  ).length;
  return Math.min(
    4,
    1 + (pw.length >= 14 ? 1 : 0) + (kinds >= 2 ? 1 : 0) + (kinds >= 3 ? 1 : 0),
  );
}

const levels = ['weak', 'weak', 'fair', 'good', 'strong'] as const;
const colors = [
  'bg-divider',
  'bg-trend-down',
  'bg-warn',
  'bg-primary',
  'bg-trend-up',
];

/** US-2.3 */
export function PasswordSection({
  profile,
  onSaved,
}: {
  profile: MyProfileDto;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string>();
  const score = passwordScore(next);

  const save = useMutation({
    mutationFn: () =>
      meControllerChangePassword({
        currentPassword: profile.hasPassword ? current : undefined,
        newPassword: next,
      }),
    onSuccess: () => {
      setOpen(false);
      setCurrent('');
      setNext('');
      setConfirm('');
      onSaved();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const issue =
      next.length < MIN
        ? t('me.tooShort')
        : next !== confirm
          ? t('me.mismatch')
          : undefined;
    setProblem(issue);
    if (!issue) save.mutate();
  };

  const status = profile.passwordChangedAt
    ? t('me.passwordChanged', {
        date: formatDate(new Date(profile.passwordChangedAt), {
          locale: i18n.language as Language,
          calendar: profile.calendar,
        }),
      })
    : t('me.noPassword');

  return (
    <Section
      id="pw"
      title={t('me.password')}
      hint={save.isSuccess ? undefined : status}
      aside={
        !open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {profile.hasPassword ? t('me.updatePassword') : t('me.setPassword')}
          </Button>
        )
      }
    >
      {save.isSuccess && !open && (
        <p role="status" className="text-sm font-medium text-trend-up">
          {t('me.passwordSaved')}
        </p>
      )}
      {open && (
        <form
          noValidate
          onSubmit={submit}
          className="flex max-w-md flex-col gap-4"
        >
          {profile.hasPassword && (
            <Field id="pw-current" label={t('me.currentPassword')}>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                className="h-11"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
          )}
          <Field id="pw-new" label={t('me.newPassword')}>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              className="h-11"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              aria-describedby="pw-strength pw-hint"
            />
            <div className="flex items-center gap-2">
              <div aria-hidden className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full',
                      i <= score ? colors[score] : 'bg-divider',
                    )}
                  />
                ))}
              </div>
              <span
                id="pw-strength"
                aria-live="polite"
                className="w-16 text-end text-[13px] text-ink-muted"
              >
                {next && t(`me.strength.${levels[score]}`)}
              </span>
            </div>
          </Field>
          <Field id="pw-confirm" label={t('me.confirmPassword')}>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              className="h-11"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <span id="pw-hint" className="text-[13px] text-ink-subtle">
            {t('me.passwordHint')}
          </span>
          <FormError
            message={
              problem ??
              (save.isError ? errorMessage(t, save.error) : undefined)
            }
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {t('me.savePassword')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setProblem(undefined);
                save.reset();
              }}
            >
              {t('admin.common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
