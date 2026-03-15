import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin }              from '@/lib/auth';
import { db }                        from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_KEYS = new Set(['classifier_tags']);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const key = new URL(req.url).searchParams.get('key') ?? 'classifier_tags';
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: 'Unknown setting key' }, { status: 400 });
    }
    const { rows } = await db.query(
      `SELECT key, value, updated_at FROM app_settings WHERE key = $1`,
      [key],
    );
    return NextResponse.json(rows[0] ?? { key, value: [] });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json() as { key?: string; value?: unknown };
    const key   = String(body.key ?? 'classifier_tags');
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: 'Unknown setting key' }, { status: 400 });
    }

    // Validate: classifier_tags must be an array of non-empty strings
    if (key === 'classifier_tags') {
      if (!Array.isArray(body.value)) {
        return NextResponse.json({ error: 'value must be an array' }, { status: 400 });
      }
      const tags = (body.value as unknown[]).filter(t => typeof t === 'string' && /^[a-z0-9-]{1,30}$/.test(t as string));
      if (tags.length === 0) {
        return NextResponse.json({ error: 'At least one valid tag required' }, { status: 400 });
      }
      const { rows } = await db.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
         RETURNING key, value, updated_at`,
        [key, JSON.stringify(tags)],
      );
      return NextResponse.json(rows[0]);
    }

    return NextResponse.json({ error: 'Unhandled key' }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    }
    console.error('PUT /api/admin/settings error:', err);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
