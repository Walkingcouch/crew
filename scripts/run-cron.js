'use strict';

/**
 * scripts/run-cron.js
 *
 * Runs the daily cron jobs (lib/cron-jobs.js) once, against the real
 * Supabase project configured in the environment. For local testing and
 * manual re-runs; Vercel calls the same runDailyCron() from api/cron/daily.js
 * on its own schedule (see vercel.json crons and DEPLOY.md).
 *
 * Usage: node scripts/run-cron.js
 */

require('dotenv').config();
const { runDailyCron } = require('../lib/cron-jobs');

runDailyCron()
  .then((results) => {
    console.log(JSON.stringify(results, null, 2));
    const failed = Object.values(results).some(r => r && r.error);
    process.exit(failed ? 1 : 0);
  })
  .catch((err) => {
    console.error('[run-cron] Fatal error:', err);
    process.exit(1);
  });
