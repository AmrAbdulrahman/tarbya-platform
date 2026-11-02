import i18next from 'i18next';
import { initI18n } from '@tarbya/i18n';
import { actedBy } from './acted-by';

describe('actedBy', () => {
  beforeAll(() => initI18n());

  it('names the author, or the super admin on their behalf', () => {
    const t = i18next.t;
    expect(actedBy(t, { name: 'Sara' })).toBe('Sara');
    expect(actedBy(t, { name: 'Sara' }, { name: 'Amr' })).toBe(
      'Amr نيابةً عن Sara',
    );
  });
});
