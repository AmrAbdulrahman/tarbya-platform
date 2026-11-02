import { ApiError } from '@tarbya/api-client';
import type { TFunction } from 'i18next';
import { errorMessage } from './error-message';

const t = ((key: string) => key) as unknown as TFunction;

describe('errorMessage', () => {
  it('uses the problem code when the API sent one', () => {
    expect(
      errorMessage(t, new ApiError(401, { code: 'AUTH_INVALID_CREDENTIALS' })),
    ).toBe('errors.AUTH_INVALID_CREDENTIALS');
  });

  it('says the server is unreachable for a bare gateway error', () => {
    expect(errorMessage(t, new ApiError(502, undefined))).toBe(
      'errors.network',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(errorMessage(t, new ApiError(500, undefined))).toBe(
      'errors.INTERNAL',
    );
    expect(errorMessage(t, new TypeError('Failed to fetch'))).toBe(
      'errors.network',
    );
  });
});
