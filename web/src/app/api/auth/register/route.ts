import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: unknown; password?: unknown };
    const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : null;
    const password = typeof body.password === 'string' ? body.password : null;

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: 'Email and password (min 8 chars) required' }, { status: 400 });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Check if this is the first user — first user gets admin role
    const countRes = await db.query('SELECT COUNT(*) as count FROM users');
    const isFirst  = parseInt((countRes.rows[0] as { count: string }).count, 10) === 0;
    const role     = isFirst ? 'admin' : 'user';

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [email, passwordHash, role],
    );
    const userId = (rows[0] as { id: string }).id;

    const token = await createSession(userId);
    const res   = NextResponse.json({ ok: true, role });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   false,
      sameSite: 'lax',
      maxAge:   SESSION_MAX_AGE,
      path:     '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
