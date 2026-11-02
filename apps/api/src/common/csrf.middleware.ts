import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppException } from './app-exception';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cookies are SameSite=Lax; on top of that every mutating request must carry
 * X-Requested-With, which a cross-site form can't set (architecture: Authentication).
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method) || req.get('x-requested-with')) {
      return next();
    }
    next(
      new AppException(403, {
        code: 'CSRF_HEADER_MISSING',
        title: 'Missing X-Requested-With header',
      }),
    );
  }
}
