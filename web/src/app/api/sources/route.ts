import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin }              from '@/lib/auth';
import { db }                        from '@/lib/db';

export async function GET() {
  try {
    await requireAdmin();
    const { rows } = await db.query(
      `SELECT s.*,
         (SELECT COUNT(*) FROM articles a WHERE a.source_id = s.id) AS article_count,
         (SELECT id FROM crawl_jobs j WHERE j.source_id = s.id ORDER BY j.created_at DESC LIMIT 1) AS last_job_id
       FROM sources s ORDER BY s.priority DESC, s.name`,
    );
    return NextResponse.json({ sources: rows });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json() as Record<string, unknown>;

    const { rows } = await db.query(
      `INSERT INTO sources
         (name, domain, rss_url, scrape_selector, date_selector, ingestion_method,
          archive_fallback, color, font, bias_default, category, priority,
          crawl_interval_mins, max_age_days, discovery_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        String(body.name ?? ''),
        String(body.domain ?? ''),
        body.rssUrl        ?? null,
        body.scrapeSelector ?? null,
        body.dateSelector   ?? null,
        String(body.ingestionMethod ?? 'rss'),
        Boolean(body.archiveFallback ?? false),
        String(body.color     ?? '#333333'),
        String(body.font      ?? 'serif'),
        body.biasDefault  ?? null,
        String(body.category  ?? 'general'),
        parseInt(String(body.priority           ?? 5),  10),
        parseInt(String(body.crawlIntervalMins  ?? 60), 10),
        parseInt(String(body.maxAgeDays         ?? 2),  10),
        body.discoveryNotes ?? null,
      ],
    );
    return NextResponse.json({ source: rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    }
    console.error('POST /api/sources error:', err);
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  }
}
