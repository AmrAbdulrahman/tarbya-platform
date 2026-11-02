import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@tarbya/shared';
import type { Language } from '@tarbya/i18n';
import { useHealthControllerCheck } from '@tarbya/api-client';

export const Route = createFileRoute('/_app/')({
  component: Home,
});

function Home() {
  const { t, i18n } = useTranslation();
  const health = useHealthControllerCheck();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-ink-subtle">
          {formatDate(new Date(), {
            locale: i18n.language as Language,
            calendar: 'BOTH',
          })}
        </span>
        <h1 className="text-3xl font-bold text-navy">{t('home.title')}</h1>
      </div>
      <section className="flex items-center gap-3 rounded-card border border-border bg-card px-6 py-5">
        <span className="text-sm text-ink-subtle">{t('home.apiStatus')}</span>
        <span
          className={
            health.isSuccess
              ? 'font-semibold text-trend-up'
              : 'font-semibold text-trend-down'
          }
        >
          {health.isSuccess ? t('home.apiOk') : t('home.apiDown')}
        </span>
      </section>
    </div>
  );
}
