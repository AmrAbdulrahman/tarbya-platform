import { firstValueFrom, take, toArray } from 'rxjs';
import { EventsService } from './events.service';

describe('EventsService', () => {
  it('delivers each event only to the users it is for', async () => {
    const events = new EventsService();
    const mine = firstValueFrom(events.for('a').pipe(take(2), toArray()));
    events.publish(['b'], { type: 'notification' });
    events.publish(['a', 'b'], { type: 'message', conversationId: 'c1' });
    events.publish([], { type: 'notification' });
    events.publish(['a'], { type: 'read', conversationId: 'c1' });
    expect(await mine).toEqual([
      { type: 'message', conversationId: 'c1' },
      { type: 'read', conversationId: 'c1' },
    ]);
  });
});
