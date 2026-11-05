import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { authControllerGetMe } from '@tarbya/api-client';

type LiveEvent =
  | { type: 'message'; conversationId: string }
  | { type: 'read'; conversationId: string }
  | { type: 'notification' };

/** Query keys each event makes stale. */
function staleKeys(event: LiveEvent): QueryKey[] {
  switch (event.type) {
    case 'message':
      return [['conversations'], ['messages', event.conversationId]];
    case 'read':
      return [['conversations']];
    case 'notification':
      return [['notifications']];
  }
}

/**
 * Listens on `GET /api/events` (Server-Sent Events) for the signed-in user and
 * refetches what changed, so messages and notifications arrive without a
 * reload (BR-NTF-2). When the stream drops, a plain request refreshes the
 * session if the access token has expired, then the stream reopens.
 */
export function useLiveEvents(userId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let stopped = false;

    const open = () => {
      source = new EventSource('/api/events', { withCredentials: true });
      source.onopen = () => {
        // Anything sent while disconnected is picked up by refetching.
        if (attempts > 0) {
          for (const key of [['conversations'], ['notifications']])
            void queryClient.invalidateQueries({ queryKey: key });
        }
        attempts = 0;
      };
      source.onmessage = (e: MessageEvent<string>) => {
        if (!e.data) return;
        const event = JSON.parse(e.data) as LiveEvent;
        for (const queryKey of staleKeys(event))
          void queryClient.invalidateQueries({ queryKey });
      };
      source.onerror = () => {
        source?.close();
        if (stopped) return;
        attempts += 1;
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
        retry = setTimeout(async () => {
          // Goes through the client's silent refresh on a 401.
          await authControllerGetMe().catch(() => undefined);
          if (!stopped) open();
        }, delay);
      };
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      source?.close();
    };
  }, [queryClient, userId]);
}
