import { ApiError } from '@tarbya/api-client';
import { isErrorCode } from '@tarbya/shared';
import type { TFunction } from 'i18next';

/** A translated message for any error a request can throw. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    return t(`errors.${isErrorCode(error.code) ? error.code : 'INTERNAL'}`);
  }
  return t('errors.network');
}
