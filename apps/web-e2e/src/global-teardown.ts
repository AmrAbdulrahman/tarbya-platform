import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Removes the users and lookups these specs created (libs/db/prisma/e2e-cleanup.sql). */
export default function globalTeardown() {
  execSync(
    'pnpm --filter @tarbya/db exec prisma db execute --file prisma/e2e-cleanup.sql',
    {
      cwd: resolve(__dirname, '../../..'),
      stdio: 'inherit',
    },
  );
}
