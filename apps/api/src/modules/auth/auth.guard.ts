import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { unauthenticated } from '../../common/app-exception';
import { IS_PUBLIC } from '../../common/public.decorator';
import { ACCESS_COOKIE } from './cookies';
import { SessionsService } from './sessions.service';

/** Global: every route needs a live session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const claims = await this.sessions.verifyAccess(
      req.cookies?.[ACCESS_COOKIE],
    );
    if (!claims) throw unauthenticated();
    req.auth = { userId: claims.sub, sessionId: claims.sid };
    return true;
  }
}
