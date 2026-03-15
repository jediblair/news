import { NextRequest,  NextResponse }  from 'next/server';
import { requireAdmin }               from '@/lib/auth';
import { db }                         from '@/lib/db';

// GET /api/crawlers/status — overall crawler status
export async function GET() {
  try {
    await requireAdmin();

    const { rows: jobs } = await db.query(
      `SELECT j.*, s.name AS source_name
       FROM crawl_jobs j
       JOIN sources    s ON j.source_id = s.id
       ORDER BY j.created_at DESC
       LIMIT 100`,
    );

    const { rows: sources } = await db.query(
      `SELECT id, name, crawl_status, last_crawl, next_crawl FROM sources WHERE active = TRUE`,
    );

    return NextResponse.json({ jobs, sources });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden'))
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
