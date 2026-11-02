import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  meControllerConfirmContactChange,
  meControllerRequestContactChange,
  type ContactKind,
  type MyProfileDto,
} from '@tarbya/api-client';
import { Button, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { FormError } from '../login/fields';
import { Section } from './section';

/** US-2.2: email and phone, each changed inline and confirmed with a code. */
export function ContactSection({
  profile,
  onSaved,
}: {
  profile: MyProfileDto;
  onSaved: (p: MyProfileDto) => void;
}) {
  const { t } = useTranslation();
  return (
    <Section id="contact" title={t('me.contact')} hint={t('me.contactHint')}>
      <ContactRow kind="EMAIL" profile={profile} onSaved={onSaved} />
      <ContactRow kind="PHONE" profile={profile} onSaved={onSaved} />
    </Section>
  );
}

type Step = 'idle' | 'editing' | 'verifying' | 'done';

function ContactRow({
  kind,
  profile,
  onSaved,
}: {
  kind: ContactKind;
  profile: MyProfileDto;
  onSaved: (p: MyProfileDto) => void;
}) {
  const { t } = useTranslation();
  const current = kind === 'EMAIL' ? profile.email : profile.phone;
  const [step, setStep] = useState<Step>('idle');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const id = kind.toLowerCase();

  const request = useMutation({
    mutationFn: () => meControllerRequestContactChange({ kind, value }),
    onSuccess: () => {
      setCode('');
      setStep('verifying');
    },
  });
  const confirm = useMutation({
    mutationFn: async () =>
      (await meControllerConfirmContactChange({ kind, code }))
        .data as MyProfileDto,
    onSuccess: (p) => {
      onSaved(p);
      setStep('done');
    },
  });
  const error = request.error ?? confirm.error;
  const reset = () => {
    request.reset();
    confirm.reset();
  };

  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4 first-of-type:border-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-col">
          <span className="text-sm text-ink-subtle">
            {kind === 'EMAIL' ? t('me.email') : t('me.phone')}
          </span>
          <span className="font-medium">
            {current ? (
              <bdi>{current}</bdi>
            ) : (
              <span className="text-ink-subtle">{t('me.notSet')}</span>
            )}
          </span>
        </div>
        {step === 'idle' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStep('editing')}
          >
            {current ? t('me.edit') : t('me.add')}
          </Button>
        )}
        {step === 'done' && (
          <span
            role="status"
            className="flex items-center gap-1.5 text-sm font-medium text-trend-up"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            {t('me.updated')}
          </span>
        )}
      </div>

      {step === 'editing' && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            reset();
            if (value.trim()) request.mutate();
          }}
        >
          <label className="flex flex-[1_1_240px] flex-col gap-1.5 text-sm font-semibold text-ink-muted">
            {kind === 'EMAIL' ? t('me.newEmail') : t('me.newPhone')}
            <Input
              id={`new-${id}`}
              type={kind === 'EMAIL' ? 'email' : 'tel'}
              dir="ltr"
              autoComplete={kind === 'EMAIL' ? 'email' : 'tel'}
              className="h-11 text-[15px] font-normal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </label>
          <Button type="submit" disabled={!value.trim() || request.isPending}>
            {t('me.sendCode')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              setStep('idle');
            }}
          >
            {t('admin.common.cancel')}
          </Button>
        </form>
      )}

      {step === 'verifying' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            reset();
            if (/^\d{6}$/.test(code)) confirm.mutate();
          }}
        >
          <p className="text-sm text-ink-muted">
            <Trans
              i18nKey={
                kind === 'EMAIL' ? 'me.codeSentEmail' : 'me.codeSentPhone'
              }
              values={{ value: kind === 'EMAIL' ? value : profile.email }}
              components={{ v: <bdi className="font-medium text-ink" /> }}
            />
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-muted">
              {t('me.code')}
              <Input
                id={`code-${id}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                dir="ltr"
                className="h-11 w-40 text-center font-figures text-lg tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </label>
            <Button
              type="submit"
              disabled={code.length !== 6 || confirm.isPending}
            >
              {t('me.verify')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                setStep('editing');
              }}
            >
              {t('me.changeValue')}
            </Button>
          </div>
        </form>
      )}
      <FormError message={error ? errorMessage(t, error) : undefined} />
    </div>
  );
}
