import { Pool } from 'pg';

// Module-level singleton to avoid creating multiple pools in dev (hot reload)
const globalForDb = globalThis as unknown as { dbPool?: Pool };

if (!globalForDb.dbPool) {
  globalForDb.dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export const db = globalForDb.dbPool;
