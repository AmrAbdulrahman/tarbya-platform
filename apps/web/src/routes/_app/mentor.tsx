import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { hasAnyRole } from '@tarbya/shared';
import { meQuery } from '../../auth/session';

/** The mentor workspace (E4): anyone with at least one mentee. */
export const Route = createFileRoute('/_app/mentor')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!hasAnyRole(me.roles, ['MENTOR'])) throw redirect({ to: '/' });
  },
  component: Outlet,
});
