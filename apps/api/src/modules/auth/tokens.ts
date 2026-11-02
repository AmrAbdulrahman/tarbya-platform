import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
/** A refresh token just rotated away still works this long, so parallel tabs don't trip reuse detection. */
export const REFRESH_GRACE_SECONDS = 30;

export const CODE_TTL_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
/** Codes sent to one address within CODE_WINDOW_MINUTES. */
export const CODE_MAX_PER_WINDOW = 3;
export const CODE_WINDOW_MINUTES = 15;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** Refresh tokens are "<sessionId>.<secret>" so a stale one still points at its session. */
export function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(
  token: string | undefined,
): { sessionId: string; secret: string } | undefined {
  const match = token?.match(/^([0-9a-f-]{36})\.([\w-]{20,})$/);
  return match ? { sessionId: match[1], secret: match[2] } : undefined;
}

export interface SessionState {
  tokenHash: string;
  previousHash: string | null;
  rotatedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type RefreshDecision = 'rotate' | 'grace' | 'reuse' | 'invalid';

/**
 * What to do with a presented refresh token (US-1.3):
 * the current one rotates; the one just replaced is tolerated briefly;
 * any older one means it leaked, so the whole session is revoked.
 */
export function decideRefresh(
  session: SessionState,
  presentedHash: string,
  now: Date,
): RefreshDecision {
  if (session.revokedAt || session.expiresAt <= now) return 'invalid';
  if (safeEqual(presentedHash, session.tokenHash)) return 'rotate';
  if (
    session.previousHash &&
    session.rotatedAt &&
    safeEqual(presentedHash, session.previousHash) &&
    now.getTime() - session.rotatedAt.getTime() <= REFRESH_GRACE_SECONDS * 1000
  ) {
    return 'grace';
  }
  return 'reuse';
}

export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Codes are short-lived and 6 digits, so an HMAC keyed by the server secret is enough. */
export function hashCode(code: string, key: string): string {
  return createHmac('sha256', key).update(code).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
