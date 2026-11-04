import { canSignIn, hasAnyRole } from './roles.js';

describe('canSignIn', () => {
  it('always lets the super admin in', () => {
    expect(canSignIn(['SUPER_ADMIN'], [])).toBe(true);
  });

  it('lets a user in when one of their roles is allowed', () => {
    expect(canSignIn(['MENTEE', 'MENTOR'], ['MODERATOR', 'MENTOR'])).toBe(true);
  });

  it('lets in someone who is a mentor, moderator and mentee at once', () => {
    expect(
      canSignIn(['MENTOR', 'MODERATOR', 'MENTEE'], ['MODERATOR', 'MENTOR']),
    ).toBe(true);
  });

  it('refuses a user whose roles are all outside the setting', () => {
    expect(canSignIn(['MENTEE'], ['MODERATOR', 'MENTOR'])).toBe(false);
    expect(canSignIn([], ['MODERATOR', 'MENTOR'])).toBe(false);
  });
});

describe('hasAnyRole', () => {
  it('matches any overlap', () => {
    expect(hasAnyRole(['MENTOR'], ['MODERATOR', 'MENTOR'])).toBe(true);
    expect(hasAnyRole(['MENTEE'], ['MODERATOR'])).toBe(false);
  });
});
