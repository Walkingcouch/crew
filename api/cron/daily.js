'use strict';

/**
 * api/cron/daily.js
 *
 * Runs the four daily jobs in lib/cron-jobs.js (recurring booking spawner,
 * credential expiry sweep, quote expiry sweep, dispute-window auto-release).
 * Scheduled once a day by the "crons" entry in vercel.json.
 *
 * Vercel signs its own cron-triggered requests with
 * "Authorization: Bearer $CRON_SECRET" (the same CRON_SECRET env var set in
 * the project), so this only has to check that header matches, no separate
 * secret needs to be minted. If CRON_SECRET isn't set, refuse to run rather
 * than silently accepting unauthenticated triggers.
 */

const { runDailyCron } = require('../../lib/cron-jobs');

module.exports = async (req, res) => {
  if (!process.env.CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET is not configured' });
  }
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await runDailyCron();
    res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('[api/cron/daily]', err.message);
    res.status(500).json({ error: 'Cron run failed', detail: err.message });
  }
};
