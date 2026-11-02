/* eslint-disable */

module.exports = async function () {
  // Nothing to stop: Nx owns the api:serve task it started for these tests,
  // and killing port 3000 here would take down an API other e2e suites share.
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
