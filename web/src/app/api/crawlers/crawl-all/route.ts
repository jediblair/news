import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin }              from '@/lib/auth';
import { db }                        from '@/lib/db';

// POST /api/crawlers/crawl-all — queue an immediate crawl for all active sources
export async function POST(_req: NextRequest) {
  try {
    await requireAdmin();
    await db.query(
      `UPDATE sources SET next_crawl = NOW() WHERE active = TRUE AND crawl_status <> 'running'`,
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden'))
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
