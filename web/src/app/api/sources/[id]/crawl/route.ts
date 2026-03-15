import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin }              from '@/lib/auth';
import { db }                        from '@/lib/db';

interface Params { params: Promise<{ id: string }> }

// POST /api/sources/[id]/crawl — trigger an immediate crawl
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

    const { rows: sourceRows } = await db.query(
      `SELECT * FROM sources WHERE id = $1 AND active = TRUE`,
      [id],
    );
    if (!sourceRows[0]) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const source = sourceRows[0] as { crawl_status: string };
    if (source.crawl_status === 'running') {
      return NextResponse.json({ error: 'Crawl already in progress' }, { status: 409 });
    }

    // Create a pending job — the ingestion worker will pick it up
    const { rows } = await db.query(
      `INSERT INTO crawl_jobs (source_id, status, triggered_by)
       VALUES ($1, 'pending', 'admin') RETURNING id`,
      [id],
    );
    // Mark source so scheduler picks it up immediately
    await db.query(
      `UPDATE sources SET next_crawl = NOW() WHERE id = $1`,
      [id],
    );

    return NextResponse.json({ ok: true, jobId: (rows[0] as { id: string }).id });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden'))
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
