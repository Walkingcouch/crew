'use strict';

/**
 * payments/index.js
 *
 * Selects the active payment provider adapter based on CHECKVAULT_ENVIRONMENT.
 * Every consumer (escrow.js, checkout.js, onboarding.js, webhooks.js, routes.js)
 * calls getProvider() rather than requiring an adapter directly, so adding a
 * second real provider later, or swapping mock for real once CheckVault
 * credentials arrive, never touches consumer code.
 */

const { assertImplementsProvider } = require('./provider');

let _provider = null;

function getProvider() {
  if (_provider) return _provider;

  const env = (process.env.CHECKVAULT_ENVIRONMENT || 'mock').toLowerCase();
  const adapter = env === 'mock'
    ? require('./checkvault-mock')
    : require('./checkvault-client');

  _provider = assertImplementsProvider(adapter, env === 'mock' ? 'checkvault-mock' : 'checkvault-client');
  return _provider;
}

/** Only for tests: forces re-selection on the next getProvider() call. */
function _resetForTests() {
  _provider = null;
}

module.exports = { getProvider, _resetForTests };
