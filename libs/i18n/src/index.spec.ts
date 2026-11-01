import { directionOf, initI18n, setLanguage } from './index.js';
import { ar } from './locales/ar.js';
import { en } from './locales/en.js';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  it('has the same keys in Arabic and English', () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });

  it('defaults to Arabic and right-to-left, and flips direction on switch', async () => {
    await initI18n();
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');

    await setLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(directionOf('ar')).toBe('rtl');
  });
});
