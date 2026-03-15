import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: unknown; password?: unknown };
    const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : null;
    const password = typeof body.password === 'string' ? body.password : null;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { rows } = await db.query(
      'SELECT id, password_hash, role FROM users WHERE email = $1',
      [email],
    );

    // Constant-time compare to prevent timing attacks
    const user = rows[0] as { id: string; password_hash: string; role: string } | undefined;
    const hashToCompare = user?.password_hash ?? '$2b$12$invalidhashfortimingprotection00000000000000000';
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const token = await createSession(user.id);

    const res = NextResponse.json({ ok: true, role: user.role });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   SESSION_MAX_AGE,
      path:     '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
