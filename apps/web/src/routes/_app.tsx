import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '../components/app-shell';

// Signed-in area. The auth guard (beforeLoad → /login) comes with the auth module.
export const Route = createFileRoute('/_app')({
  component: AppShell,
});
