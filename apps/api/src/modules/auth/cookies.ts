import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } from './tokens';
import type { IssuedTokens } from './sessions.service';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

function base(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure };
}

// The access token goes with every API call; the refresh token only to /api/auth.
const accessOptions = (secure: boolean): CookieOptions => ({
  ...base(secure),
  path: '/api',
});
const refreshOptions = (secure: boolean): CookieOptions => ({
  ...base(secure),
  path: '/api/auth',
});

export function setAuthCookies(
  res: Response,
  tokens: IssuedTokens,
  secure: boolean,
) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...accessOptions(secure),
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  if (tokens.refreshToken) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...refreshOptions(secure),
      maxAge: REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    });
  }
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_COOKIE, accessOptions(secure));
  res.clearCookie(REFRESH_COOKIE, refreshOptions(secure));
}
