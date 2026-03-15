import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';
import { requireAdmin, getSession }  from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let admin;
  try { admin = await requireAdmin(); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { role?: string };
  const role = body.role;
  if (!role || !['admin', 'user'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Prevent removing your own admin role
  if (params.id === admin.id && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
  }

  await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, params.id]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  let admin;
  try { admin = await requireAdmin(); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent deleting yourself
  if (params.id === admin.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  // Delete sessions first (cascade should handle it, but be explicit)
  await db.query('DELETE FROM sessions WHERE user_id = $1', [params.id]);
  await db.query('DELETE FROM users WHERE id = $1', [params.id]);
  return NextResponse.json({ ok: true });
}
