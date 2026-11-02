import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { hasAnyRole } from '@tarbya/shared';
import { meQuery } from '../../auth/session';

/** Administration (E3): the super admin and moderators only (BR-ADM-1). */
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!hasAnyRole(me.roles, ['SUPER_ADMIN', 'MODERATOR'])) {
      throw redirect({ to: '/' });
    }
  },
  component: Outlet,
});
