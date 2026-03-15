import { db }             from './db';
import { startScheduler } from './scheduler';

async function main(): Promise<void> {
  console.log('[ingestion] Starting news ingestion worker...');

  // Wait for DB to be ready
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await db.query('SELECT 1');
      console.log('[ingestion] Database connection established');
      break;
    } catch (err) {
      console.warn(`[ingestion] DB not ready (attempt ${attempt}/10), retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      if (attempt === 10) {
        console.error('[ingestion] Could not connect to database. Exiting.');
        process.exit(1);
      }
    }
  }

  startScheduler();
}

main().catch(err => {
  console.error('[ingestion] Fatal error:', err);
  process.exit(1);
});
