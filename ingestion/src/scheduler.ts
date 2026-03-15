import cron from 'node-cron';
import { db }           from './db';
import { crawlSource }  from './crawler';
import type { Source }  from './crawler';

let running = false;

/**
 * Check for sources due to be crawled and dispatch jobs.
 */
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { rows: sources } = await db.query<Source>(
      `SELECT * FROM sources
       WHERE active = TRUE
         AND crawl_status <> 'running'
         AND (next_crawl IS NULL OR next_crawl <= NOW())
       ORDER BY priority DESC
       LIMIT 5`,  // process max 5 at once to avoid overwhelming
    );

    for (const source of sources) {
      await runJob(source, 'schedule');
    }
  } catch (err) {
    console.error('[scheduler] tick error:', err);
  } finally {
    running = false;
  }
}

export async function runJob(
  source: Source,
  triggeredBy: 'schedule' | 'manual' | 'admin',
): Promise<void> {
  const { rows } = await db.query(
    `INSERT INTO crawl_jobs (source_id, status, triggered_by)
     VALUES ($1, 'pending', $2)
     RETURNING id`,
    [source.id, triggeredBy],
  );
  const jobId = rows[0].id as string;

  await db.query(
    `UPDATE sources SET crawl_status = 'running' WHERE id = $1`,
    [source.id],
  );
  await db.query(
    `UPDATE crawl_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
    [jobId],
  );

  try {
    const { found, added, updated } = await crawlSource(source, jobId);

    await db.query(
      `UPDATE crawl_jobs
       SET status = 'completed', completed_at = NOW(),
           articles_found = $2, articles_new = $3, articles_updated = $4
       WHERE id = $1`,
      [jobId, found, added, updated],
    );
    await db.query(
      `UPDATE sources
       SET crawl_status = 'idle',
           last_crawl   = NOW(),
           next_crawl   = NOW() + (crawl_interval_mins || ' minutes')::INTERVAL
       WHERE id = $1`,
      [source.id],
    );
  } catch (err) {
    const message = (err as Error).message;
    await db.query(
      `UPDATE crawl_jobs
       SET status = 'failed', completed_at = NOW(), error_message = $2
       WHERE id = $1`,
      [jobId, message],
    );
    await db.query(
      `UPDATE sources SET crawl_status = 'error' WHERE id = $1`,
      [source.id],
    );
    console.error(`[scheduler] Job ${jobId} failed:`, message);
  }
}

/** Start the scheduler — runs every 2 minutes to check for pending crawls. */
export function startScheduler(): void {
  console.log('[scheduler] Starting — checking every 2 minutes');
  cron.schedule('*/2 * * * *', tick);
  // Also run immediately on startup
  setTimeout(tick, 5000);
}
