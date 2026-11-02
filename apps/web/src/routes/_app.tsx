import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppShell } from '../components/app-shell';
import { meQuery } from '../auth/session';

// Signed-in area: anyone without a session goes to /login and comes back after.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery);
    } catch {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AppShell,
});
