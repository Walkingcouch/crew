'use strict';

/**
 * api/index.js
 *
 * Vercel serverless entry point: the whole Express app (all /api/* routes,
 * session check, config endpoint) runs as one function. Static HTML/CSS/JS/
 * images are served by Vercel's own static hosting per vercel.json, never
 * by this function, so it only ever sees requests vercel.json rewrites to
 * /api/(.*) -- see the "api" rewrite added there for Phase 8.
 */

module.exports = require('../server.js');
