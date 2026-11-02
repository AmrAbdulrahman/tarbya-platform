/**
 * Stable `code` values in the API's problem-details responses (RFC 9457).
 * The web maps each one to a translated message under `errors.<code>`.
 */
export const ERROR_CODES = [
  'AUTH_UNAUTHENTICATED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_CODE_INVALID',
  'AUTH_NOT_ALLOWED',
  'AUTH_DEACTIVATED',
  'CSRF_HEADER_MISSING',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'USER_EMAIL_TAKEN',
  'USER_PHONE_TAKEN',
  'MANAGER_CYCLE',
  'MANAGER_INACTIVE',
  'MANAGER_NOT_MODERATOR',
  'MODERATOR_HAS_REPORTS',
  'SUPER_ADMIN_LOCKED',
  'SELF_ACTION',
  'MENTEE_HAS_MENTOR',
  'MENTORSHIP_CYCLE',
  'USER_INACTIVE',
  'NOT_YOUR_MENTEE',
  'ACTIVITY_TYPE_INVALID',
  'NOTE_WIDEN_CONFIRM',
  'FORBIDDEN',
  'NOT_FOUND',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return ERROR_CODES.includes(value as ErrorCode);
}
