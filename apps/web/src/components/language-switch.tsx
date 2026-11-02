import { useTranslation } from 'react-i18next';
import { Button } from '@tarbya/ui';
import { setLanguage } from '@tarbya/i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'ar' ? 'en' : 'ar';
  return (
    <Button
      variant="outline"
      size="sm"
      lang={next}
      onClick={() => setLanguage(next)}
    >
      {t('header.switchLanguage')}
    </Button>
  );
}
