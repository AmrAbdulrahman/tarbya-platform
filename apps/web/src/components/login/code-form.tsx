import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  authControllerRequestCode,
  authControllerSignInWithCode,
  type MeDto,
} from '@tarbya/api-client';
import { Button, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from './fields';
import { OtpInput } from './otp-input';

const RESEND_AFTER_SECONDS = 60;
const emailSchema = z.email();

interface Props {
  defaultEmail: string;
  onEmailChange: (email: string) => void;
  onSignedIn: (me: MeDto) => void;
}

/** US-1.2: ask for a code by email, then enter it. */
export function CodeForm({ defaultEmail, onEmailChange, onSignedIn }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(defaultEmail);
  const [emailError, setEmailError] = useState(false);
  const [sent, setSent] = useState<{ to: string; at: number }>();
  const sentTo = sent?.to;
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const secondsLeft = useCountdown(sent?.at);

  const request = useMutation({
    mutationFn: (address: string) =>
      authControllerRequestCode({ email: address }),
    onSuccess: (_res, address) => {
      setSent({ to: address, at: Date.now() });
      setCode('');
    },
  });
  const verify = useMutation({
    mutationFn: (value: string) =>
      authControllerSignInWithCode({ email: sentTo ?? email, code: value }),
    onSuccess: (res) => onSignedIn(res.data as MeDto),
    onError: () => setCode(''),
  });

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    const valid = emailSchema.safeParse(email.trim()).success;
    setEmailError(!valid);
    if (valid) request.mutate(email.trim());
  };

  const submitCode = (value: string) => {
    const complete = /^\d{6}$/.test(value);
    setCodeError(!complete);
    if (complete && !verify.isPending) verify.mutate(value);
  };

  if (!sent) {
    return (
      <form noValidate onSubmit={sendCode} className="flex flex-col gap-4">
        <Field
          id="code-email"
          label={t('login.email')}
          error={emailError ? t('validation.email') : undefined}
        >
          <Input
            id="code-email"
            type="email"
            dir="ltr"
            autoComplete="username"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              onEmailChange(e.target.value);
            }}
            aria-invalid={emailError}
            aria-describedby={emailError ? 'code-email-error' : undefined}
          />
        </Field>
        <FormError
          message={request.isError ? errorMessage(t, request.error) : undefined}
        />
        <Button
          type="submit"
          className="h-12 text-base"
          disabled={request.isPending}
        >
          {t('login.sendCode')}
        </Button>
      </form>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submitCode(code);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-ink-muted">
        <Trans
          i18nKey="login.codeSentTo"
          values={{ email: sentTo }}
          components={{
            email: <bdi dir="ltr" className="font-medium text-ink" />,
          }}
        />{' '}
        <button
          type="button"
          onClick={() => setSent(undefined)}
          className="font-medium text-primary hover:text-primary-hover"
        >
          {t('login.changeEmail')}
        </button>
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink-muted">
          {t('login.enterCode')}
        </legend>
        <OtpInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setCodeError(false);
          }}
          onComplete={submitCode}
          invalid={codeError || verify.isError}
          disabled={verify.isPending}
        />
        {codeError && (
          <p className="text-sm text-trend-down">{t('validation.code')}</p>
        )}
        {secondsLeft > 0 ? (
          <span className="text-[13px] text-ink-subtle">
            {t('login.resendIn', { time: formatSeconds(secondsLeft) })}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => request.mutate(sent.to)}
            disabled={request.isPending}
            className="self-start text-[13px] font-medium text-primary hover:text-primary-hover"
          >
            {t('login.resend')}
          </button>
        )}
      </fieldset>
      <FormError
        message={
          verify.isError
            ? errorMessage(t, verify.error)
            : request.isError
              ? errorMessage(t, request.error)
              : undefined
        }
      />
      <Button
        type="submit"
        className="h-12 text-base"
        disabled={verify.isPending}
      >
        {t('login.submit')}
      </Button>
    </form>
  );
}

/** Seconds until another code may be requested; restarts whenever a code is sent. */
function useCountdown(sentAt: number | undefined): number {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!sentAt) return;
    const tick = () =>
      setLeft(
        Math.max(
          0,
          RESEND_AFTER_SECONDS - Math.floor((Date.now() - sentAt) / 1000),
        ),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sentAt]);

  return left;
}

function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
