import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin }              from '@/lib/auth';
import { db }                        from '@/lib/db';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { rows } = await db.query('SELECT * FROM sources WHERE id = $1', [id]);
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ source: rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden'))
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;

    const { rows } = await db.query(
      `UPDATE sources SET
         name               = $2,
         domain             = $3,
         rss_url            = $4,
         scrape_selector    = $5,
         date_selector      = $6,
         ingestion_method   = $7,
         archive_fallback   = $8,
         color              = $9,
         font               = $10,
         bias_default       = $11,
         category           = $12,
         priority           = $13,
         crawl_interval_mins = $14,
         max_age_days       = $15,
         active             = $16,
         discovery_notes    = $17
       WHERE id = $1
       RETURNING *`,
      [
        id,
        String(body.name    ?? ''),
        String(body.domain  ?? ''),
        body.rssUrl         ?? null,
        body.scrapeSelector ?? null,
        body.dateSelector   ?? null,
        String(body.ingestionMethod ?? 'rss'),
        Boolean(body.archiveFallback ?? false),
        String(body.color    ?? '#333333'),
        String(body.font     ?? 'serif'),
        body.biasDefault ?? null,
        String(body.category ?? 'general'),
        parseInt(String(body.priority           ?? 5),  10),
        parseInt(String(body.crawlIntervalMins  ?? 60), 10),
        parseInt(String(body.maxAgeDays         ?? 2),  10),
        Boolean(body.active ?? true),
        body.discoveryNotes ?? null,
      ],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ source: rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden'))
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    await db.query('DELETE FROM sources WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden'))
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
