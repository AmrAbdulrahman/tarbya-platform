import {
  decideRefresh,
  formatRefreshToken,
  hashCode,
  newCode,
  parseRefreshToken,
  REFRESH_GRACE_SECONDS,
  type SessionState,
} from './tokens';

const now = new Date('2026-11-01T12:00:00Z');
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);

function session(overrides: Partial<SessionState> = {}): SessionState {
  return {
    tokenHash: 'current',
    previousHash: 'previous',
    rotatedAt: now,
    expiresAt: later(3600),
    revokedAt: null,
    ...overrides,
  };
}

describe('decideRefresh', () => {
  it('rotates the current token', () => {
    expect(decideRefresh(session(), 'current', now)).toBe('rotate');
  });

  it('tolerates the token it just replaced within the grace window', () => {
    expect(
      decideRefresh(session(), 'previous', later(REFRESH_GRACE_SECONDS)),
    ).toBe('grace');
  });

  it('treats the replaced token as reuse once the grace window has passed', () => {
    expect(
      decideRefresh(session(), 'previous', later(REFRESH_GRACE_SECONDS + 1)),
    ).toBe('reuse');
  });

  it('treats any older token as reuse', () => {
    expect(decideRefresh(session(), 'older', now)).toBe('reuse');
  });

  it('rejects revoked and expired sessions', () => {
    expect(decideRefresh(session({ revokedAt: now }), 'current', now)).toBe(
      'invalid',
    );
    expect(decideRefresh(session({ expiresAt: now }), 'current', now)).toBe(
      'invalid',
    );
  });
});

describe('refresh token format', () => {
  const id = '3f1c2a9e-6b7d-4c1e-9f00-1234567890ab';

  it('round-trips the session id and secret', () => {
    const secret = 'abcdefghijklmnopqrstuvwxyz_-0123';
    expect(parseRefreshToken(formatRefreshToken(id, secret))).toEqual({
      sessionId: id,
      secret,
    });
  });

  it('rejects malformed values', () => {
    expect(parseRefreshToken(undefined)).toBeUndefined();
    expect(parseRefreshToken('nope')).toBeUndefined();
    expect(parseRefreshToken(`${id}.short`)).toBeUndefined();
  });
});

describe('codes', () => {
  it('are six digits', () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });

  it('hash differently under different keys', () => {
    expect(hashCode('123456', 'a')).not.toBe(hashCode('123456', 'b'));
    expect(hashCode('123456', 'a')).toBe(hashCode('123456', 'a'));
  });
});
