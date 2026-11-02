import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { MeDto } from '@tarbya/api-client';
import { cn } from '@tarbya/ui';
import { meQuery } from '../auth/session';
import { CodeForm } from '../components/login/code-form';
import { LanguageToggle } from '../components/login/language-toggle';
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
  const [method, setMethod] = useState<Method>('password');
  // Kept across tabs so switching method doesn't lose what was typed.
  const [email, setEmail] = useState('');

  const onSignedIn = (me: MeDto) => {
    queryClient.setQueryData(meQuery.queryKey, me);
    router.history.push(back ?? '/');
  };

  return (
    <div className="flex min-h-screen flex-wrap bg-card">
      <section className="login-dots flex min-h-72 flex-[1_1_420px] flex-col justify-between gap-10 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-card bg-primary text-[22px] font-bold">
            ت
          </div>
          <span className="text-[22px] font-bold">{t('app.name')}</span>
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

      <section className="flex flex-[1_1_480px] flex-col px-12 py-10 max-sm:px-4">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <main className="my-auto flex w-full max-w-[420px] flex-col gap-5 self-center py-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[28px] font-bold text-navy">
              {t('login.title')}
            </h2>
            <span className="text-[15px] text-ink-subtle">
              {t('login.lead')}
            </span>
          </div>

          <div
            role="tablist"
            aria-label={t('login.method')}
            className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1"
          >
            {(['password', 'code'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={`tab-${m}`}
                aria-selected={method === m}
                aria-controls={`panel-${m}`}
                onClick={() => setMethod(m)}
                className={cn(
                  'h-10 rounded-md text-[15px] font-semibold',
                  method === m
                    ? 'bg-card text-navy shadow-sm'
                    : 'text-ink-muted hover:text-primary',
                )}
              >
                {t(m === 'password' ? 'login.password' : 'login.code')}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`panel-${method}`}
            aria-labelledby={`tab-${method}`}
          >
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
          </div>

          <p className="text-center text-[13px] leading-[1.7] text-ink-subtle">
            {t('login.note')}
          </p>
        </main>
      </section>
    </div>
  );
}
