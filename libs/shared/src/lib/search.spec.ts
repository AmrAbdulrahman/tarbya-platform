import { matchesSearch, normalizeSearch } from './search.js';

describe('search normalisation (BR-USR-6)', () => {
  it('folds every form of alef', () => {
    for (const name of ['أحمد', 'إحمد', 'آحمد', 'ٱحمد'])
      expect(normalizeSearch(name)).toBe('احمد');
  });

  it('folds alef maqsura, taa marbuta and hamza seats', () => {
    expect(normalizeSearch('مصطفى')).toBe(normalizeSearch('مصطفي'));
    expect(normalizeSearch('فاطمة')).toBe(normalizeSearch('فاطمه'));
    expect(normalizeSearch('مؤمن')).toBe('مومن');
    expect(normalizeSearch('هانئ')).toBe('هاني');
  });

  it('drops diacritics and tatweel', () => {
    expect(normalizeSearch('مُحَمَّد')).toBe('محمد');
    expect(normalizeSearch('محـــمد')).toBe('محمد');
  });

  it('reads Arabic-Indic digits and ignores case', () => {
    expect(normalizeSearch('٠١٠٢')).toBe('0102');
    expect(normalizeSearch('  Omar ')).toBe('omar');
  });

  it('matches across fields', () => {
    expect(matchesSearch('احمد', 'Library', 'أحمد علي')).toBe(true);
    expect(matchesSearch('سالم', 'أحمد', null)).toBe(false);
    expect(matchesSearch(' ', 'anything')).toBe(true);
  });
});
