import { Injectable } from '@nestjs/common';
import { filter, map, Subject, type Observable } from 'rxjs';

/** What the web hears about; it refetches the matching queries (BR-NTF-2). */
export type LiveEvent =
  | { type: 'message'; conversationId: string }
  | { type: 'read'; conversationId: string }
  | { type: 'notification' };

interface Envelope {
  userIds: readonly string[];
  event: LiveEvent;
}

/**
 * The in-process event bus behind `GET /api/events` (docs/architecture.md,
 * "Realtime"). With more than one API instance, fan out through Postgres
 * LISTEN/NOTIFY here; the stream contract stays the same.
 */
@Injectable()
export class EventsService {
  private readonly bus = new Subject<Envelope>();

  publish(userIds: readonly string[], event: LiveEvent) {
    if (userIds.length) this.bus.next({ userIds, event });
  }

  for(userId: string): Observable<LiveEvent> {
    return this.bus.pipe(
      filter((e) => e.userIds.includes(userId)),
      map((e) => e.event),
    );
  }
}
