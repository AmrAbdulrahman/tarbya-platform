import { waitForPortOpen } from '@nx/node/utils';

/** Waits for the API that Nx starts for this suite. */
module.exports = async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await waitForPortOpen(port, { host });
};
