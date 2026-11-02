import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@tarbya/shared';

export interface ProblemBody {
  code: ErrorCode;
  title: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

/** An error with a stable code; the problem-details filter turns it into RFC 9457 JSON. */
export class AppException extends HttpException {
  constructor(status: number, body: ProblemBody) {
    super(body, status);
  }
}

export const unauthenticated = () =>
  new AppException(401, {
    code: 'AUTH_UNAUTHENTICATED',
    title: 'Sign in required',
  });
