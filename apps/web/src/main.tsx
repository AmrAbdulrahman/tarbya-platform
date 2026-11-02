import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { ApiError } from '@tarbya/api-client';
import { initI18n } from '@tarbya/i18n';
import { routeTree } from './routeTree.gen';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // The session ended mid-use (refresh failed): back to sign-in, then here again.
    onError: (error) => {
      const { pathname, href } = router.state.location;
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        pathname !== '/login'
      ) {
        void router.navigate({ to: '/login', search: { redirect: href } });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Client errors won't fix themselves; retry only network and server failures.
      retry: (count, error) =>
        count < 1 && !(error instanceof ApiError && error.status < 500),
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

await initI18n();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
