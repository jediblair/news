import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession, SESSION_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
