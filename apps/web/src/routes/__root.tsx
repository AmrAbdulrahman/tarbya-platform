import type { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { directionOf, type Language } from '@tarbya/i18n';
import { DirectionProvider } from '@tarbya/ui';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

function Root() {
  const { i18n } = useTranslation();
  return (
    <DirectionProvider dir={directionOf(i18n.language as Language)}>
      <Outlet />
    </DirectionProvider>
  );
}
