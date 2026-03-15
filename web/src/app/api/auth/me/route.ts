import { NextRequest, NextResponse } from 'next/server';
import { getSession }                from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { email: session.email, role: session.role } });
}
