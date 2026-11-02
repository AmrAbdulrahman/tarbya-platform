import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ErrorCode } from '@tarbya/shared';
import type { Response } from 'express';
import type { ProblemBody } from './app-exception';

const codeForStatus: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'AUTH_UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'FILE_TOO_LARGE',
  429: 'RATE_LIMITED',
};

/** Every error leaves the API as application/problem+json with a stable `code`. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toProblem(exception);
    if (status >= 500) this.logger.error(exception);
    res
      .status(status)
      .type('application/problem+json')
      .json({ type: 'about:blank', status, ...body });
  }

  private toProblem(exception: unknown): { status: number; body: ProblemBody } {
    if (exception instanceof ThrottlerException) {
      return {
        status: 429,
        body: { code: 'RATE_LIMITED', title: 'Too many requests' },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && 'code' in response) {
        return { status, body: response as ProblemBody };
      }
      return {
        status,
        body: {
          code: codeForStatus[status] ?? 'INTERNAL',
          title: exception.message,
        },
      };
    }
    return {
      status: 500,
      body: { code: 'INTERNAL', title: 'Something went wrong' },
    };
  }
}
