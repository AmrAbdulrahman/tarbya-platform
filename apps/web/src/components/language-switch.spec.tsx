import { fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '@tarbya/i18n';
import { LanguageSwitch } from './language-switch';

describe('LanguageSwitch', () => {
  beforeAll(() => initI18n('ar'));

  it('switches between Arabic (RTL) and English (LTR)', async () => {
    render(<LanguageSwitch />);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('button', { name: 'العربية' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('ltr');
  });
});
