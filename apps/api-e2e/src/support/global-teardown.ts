import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { MAILPIT_URL } from './fixtures';

/**
 * Removes the users, lookups and emails this suite created (libs/db/prisma/e2e-cleanup.sql).
 * Nothing to stop: Nx owns the api:serve task it started, and other suites may share it.
 */
module.exports = async function () {
  execSync(
    'pnpm --filter @tarbya/db exec prisma db execute --file prisma/e2e-cleanup.sql',
    {
      cwd: resolve(__dirname, '../../../..'),
      stdio: 'inherit',
    },
  );
  await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent('to:tarbya.test')}`,
    { method: 'DELETE' },
  ).catch(() => undefined);
};
