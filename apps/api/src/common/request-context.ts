import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type NestMiddleware } from '@nestjs/common';

/** Per-request facts that services deep in a call need without passing them down. */
export interface RequestState {
  /** The super admin behind an impersonated request (set by the auth guard). */
  impersonatorId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestState>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void) {
    requestContext.run({}, next);
  }
}
