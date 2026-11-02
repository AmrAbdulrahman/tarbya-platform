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

  it('gives every Arabic plural all six forms', () => {
    // Arabic picks zero/one/two/few/many/other; a missing form shows the raw key.
    const forms = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const all = new Set(keys(ar));
    const plurals = new Set(
      [...all]
        .filter((k) => forms.some((f) => k.endsWith(`_${f}`)))
        .map((k) => k.replace(/_[a-z]+$/, '')),
    );
    const missing = [...plurals].flatMap((base) =>
      forms.filter((f) => !all.has(`${base}_${f}`)).map((f) => `${base}_${f}`),
    );
    expect(missing).toEqual([]);
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
