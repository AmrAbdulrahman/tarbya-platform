import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** What the auth guard attaches to each signed-in request. */
export interface AuthContext {
  /** Whose app this is; while impersonating, the impersonated user. */
  userId: string;
  sessionId: string;
  /** The super admin, while they impersonate `userId`. */
  impersonatorId?: string;
}

declare module 'express' {
  interface Request {
    auth?: AuthContext;
  }
}

/** The signed-in user's ids. Only valid on routes the auth guard protects. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const auth = ctx.switchToHttp().getRequest<Request>().auth;
    if (!auth) throw new Error('CurrentAuth used on a public route');
    return auth;
  },
);
