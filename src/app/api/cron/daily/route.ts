// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runDailyCron } = require("../../../../server/lib/cron-jobs.js");

/**
 * Runs the four daily jobs (recurring booking spawner, credential expiry
 * sweep, quote expiry sweep, dispute-window auto-release). Scheduled by
 * vercel.json's crons entry. Vercel signs its own cron-triggered requests
 * with "Authorization: Bearer $CRON_SECRET" (the same env var set in the
 * project), so this only needs to check that header matches.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runDailyCron();
    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ error: "Cron run failed", detail: (err as Error).message }, { status: 500 });
  }
}
