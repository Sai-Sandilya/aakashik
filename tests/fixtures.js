/**
 * Shared Playwright fixtures — auto-reset API commerce fixtures before every test
 * so hide/stock mutations from one suite cannot poison later checkout specs.
 */
const base = require('@playwright/test');
const { resetE2eApi } = require('./helpers/e2e-api');

const test = base.test.extend({
  // eslint-disable-next-line no-empty-pattern
  autoResetApi: [async ({ request }, use) => {
    await resetE2eApi(request);
    await use();
  }, { auto: true }],
});

module.exports = { test, expect: base.expect };
