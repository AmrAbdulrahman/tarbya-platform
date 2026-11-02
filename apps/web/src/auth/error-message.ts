import { ApiError } from '@tarbya/api-client';
import { isErrorCode } from '@tarbya/shared';
import type { TFunction } from 'i18next';

/** A translated message for any error a request can throw. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (isErrorCode(error.code)) return t(`errors.${error.code}`);
    // A gateway error with no problem body: the proxy couldn't reach the API.
    if (error.status >= 502 && error.status <= 504) return t('errors.network');
    return t('errors.INTERNAL');
  }
  return t('errors.network');
}
