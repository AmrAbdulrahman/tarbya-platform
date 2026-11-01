import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ar, type Messages } from './locales/ar.js';
import { en } from './locales/en.js';

export type Language = 'ar' | 'en';
export const languages: readonly Language[] = ['ar', 'en'];
export const defaultLanguage: Language = 'ar';

const STORAGE_KEY = 'tarbya.lang';

export function directionOf(lang: Language): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** Keep <html lang dir> in step with the active language (BR-ORG-2). */
function applyToDocument(lang: Language) {
  document.documentElement.lang = lang;
  document.documentElement.dir = directionOf(lang);
}

function storedLanguage(): Language | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return languages.includes(value as Language)
      ? (value as Language)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function initI18n(initial?: Language) {
  const lng = initial ?? storedLanguage() ?? defaultLanguage;
  await i18next.use(initReactI18next).init({
    resources: { ar: { translation: ar }, en: { translation: en } },
    lng,
    fallbackLng: defaultLanguage,
    interpolation: { escapeValue: false },
  });
  applyToDocument(lng);
  i18next.on('languageChanged', (next) => applyToDocument(next as Language));
  return i18next;
}

export async function setLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage unavailable: the choice lasts for this tab only
  }
  await i18next.changeLanguage(lang);
}

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Messages };
  }
}

export type { Messages };
