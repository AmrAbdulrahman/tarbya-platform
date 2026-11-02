import { passwordScore } from './password-section';

describe('passwordScore', () => {
  it('stays weak below the 10-character minimum', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('Abc1!')).toBe(1);
  });

  it('rewards length and variety', () => {
    expect(passwordScore('aaaaaaaaaa')).toBe(1);
    expect(passwordScore('aaaaaaaaa1')).toBe(2);
    expect(passwordScore('Aaaaaaaaa1')).toBe(3);
    expect(passwordScore('Correct-Horse-9-Battery')).toBe(4);
  });
});
