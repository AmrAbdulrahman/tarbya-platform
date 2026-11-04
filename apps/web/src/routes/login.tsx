import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { MeDto } from '@tarbya/api-client';
import { setLanguage } from '@tarbya/i18n';
import { meQuery } from '../auth/session';
import { CodeForm } from '../components/login/code-form';
import { LanguageToggle } from '../components/login/language-toggle';
import { LogoMark } from '../components/logo';
import { PasswordForm } from '../components/login/password-form';

const search = z.object({
  // Same-origin paths only, so the link can't send people elsewhere.
  redirect: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional()
    .catch(undefined),
});

/** US-1.1, US-1.2, US-1.4 · design/screens/Login.dc.html */
export const Route = createFileRoute('/login')({
  validateSearch: search,
  beforeLoad: async ({ context, search }) => {
    const me = await context.queryClient
      .ensureQueryData(meQuery)
      .catch(() => undefined);
    if (me) throw redirect({ href: search.redirect ?? '/' });
  },
  component: Login,
});

type Method = 'password' | 'code';

function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { redirect: back } = Route.useSearch();
  // A one-time code first: most members won't have set a password.
  const [method, setMethod] = useState<Method>('code');
  // Kept across tabs so switching method doesn't lose what was typed.
  const [email, setEmail] = useState('');

  const onSignedIn = async (me: MeDto) => {
    queryClient.setQueryData(meQuery.queryKey, me);
    // Each member's default language (BR-ORG-2) wins over the one picked on this screen.
    await setLanguage(me.locale);
    router.history.push(back ?? '/');
  };

  return (
    <div className="flex min-h-screen flex-wrap bg-surface">
      <section className="login-hero pattern-corner pattern-start flex min-h-72 flex-[1_1_420px] flex-col justify-between gap-10 p-12 text-white">
        <div className="flex items-center gap-3">
          <LogoMark tone="onDark" className="h-14 w-auto shrink-0" />
          <div className="flex flex-col">
            <span className="text-[24px] font-bold">{t('app.name')}</span>
            <span className="text-[13px] text-white/75">
              {t('app.tagline')}
            </span>
          </div>
        </div>
        <div className="flex max-w-[460px] flex-col gap-4">
          <h1 className="text-[40px] font-bold leading-tight">
            {t('login.hero')}
          </h1>
          <p className="text-[17px] leading-[1.8] text-white/80">
            {t('login.sub')}
          </p>
        </div>
        <span className="text-[13px] text-white/70">{t('login.closed')}</span>
      </section>

      <section className="pattern-corner flex flex-[1_1_480px] flex-col px-12 py-10 max-sm:px-4">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <main className="my-auto flex w-full max-w-[420px] flex-col gap-5 self-center py-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[28px] font-bold text-brand">
              {t('login.title')}
            </h2>
            <span className="text-[15px] text-ink-subtle">
              {t('login.lead')}
            </span>
          </div>

          {method === 'password' ? (
            <PasswordForm
              defaultEmail={email}
              onEmailChange={setEmail}
              onForgot={() => setMethod('code')}
              onSignedIn={onSignedIn}
            />
          ) : (
            <CodeForm
              defaultEmail={email}
              onEmailChange={setEmail}
              onSignedIn={onSignedIn}
            />
          )}

          <button
            type="button"
            onClick={() =>
              setMethod(method === 'password' ? 'code' : 'password')
            }
            className="self-center text-[15px] font-medium text-primary hover:text-primary-hover hover:underline"
          >
            {method === 'password'
              ? t('login.useCode')
              : t('login.usePassword')}
          </button>

          <p className="text-center text-[13px] leading-[1.7] text-ink-subtle">
            {t('login.note')}
          </p>
        </main>
      </section>
    </div>
  );
}
