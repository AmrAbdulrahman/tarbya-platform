import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { interval, map, merge, takeUntil, timer, type Observable } from 'rxjs';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { EventsService } from './events.service';

/** Keeps proxies from closing a quiet stream. */
const HEARTBEAT_MS = 25_000;
/**
 * The stream ends before the access token would, so the browser reconnects
 * and the session is checked again (a revoked one stops getting events).
 */
const LIFETIME_MS = 14 * 60_000;

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Server-Sent Events for the signed-in user: new messages and notifications (BR-NTF-2). */
  @Sse()
  @ApiExcludeEndpoint()
  stream(@CurrentAuth() auth: AuthContext): Observable<MessageEvent> {
    return merge(
      this.events.for(auth.userId).pipe(map((data) => ({ data }))),
      interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'ping', data: '' }))),
    ).pipe(takeUntil(timer(LIFETIME_MS)));
  }
}
