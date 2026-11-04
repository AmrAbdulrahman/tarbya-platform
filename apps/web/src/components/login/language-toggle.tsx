import { useTranslation } from 'react-i18next';
import { languages, setLanguage, type Language } from '@tarbya/i18n';
import { cn } from '@tarbya/ui';

const labels: Record<Language, string> = { ar: 'عربي', en: 'English' };

/** The sign-in screen's two-button language switch (US-1.4). */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('login.language')}
      className="inline-flex overflow-hidden rounded-full border border-border"
    >
      {languages.map((lang) => {
        const active = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            lang={lang}
            aria-pressed={active}
            onClick={() => setLanguage(lang)}
            className={cn(
              'h-10 px-4 text-sm font-semibold',
              active
                ? 'bg-brand text-white'
                : 'bg-card text-ink-muted hover:text-primary',
            )}
          >
            {labels[lang]}
          </button>
        );
      })}
    </div>
  );
}
