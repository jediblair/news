import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';
import { requireAdmin }              from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await db.query(
    `SELECT id, email, role, created_at, last_login FROM users ORDER BY created_at ASC`,
  );
  return NextResponse.json(rows);
}
