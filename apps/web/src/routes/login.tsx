import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '../components/language-switch';

// Placeholder until US-1.1 / US-1.2 (design/screens/Login.dc.html).
export const Route = createFileRoute('/login')({
  component: Login,
});

function Login() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-card border border-border bg-card p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-navy">{t('login.title')}</h1>
          <LanguageSwitch />
        </div>
      </div>
    </main>
  );
}
