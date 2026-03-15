import { cookies } from 'next/headers';
import { db }      from './db';

export interface SessionUser {
  id:    string;
  email: string;
  role:  'admin' | 'user';
}

const SESSION_COOKIE  = 'news_session';
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { rows } = await db.query(
    `SELECT u.id, u.email, u.role
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = $1
       AND s.expires_at > NOW()`,
    [token],
  );
  return (rows[0] as SessionUser) ?? null;
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== 'admin') throw new Error('Forbidden');
  return session;
}

export async function createSession(userId: string): Promise<string> {
  const { randomBytes } = await import('crypto');
  const token      = randomBytes(32).toString('hex');
  const expiresAt  = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await db.query(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt],
  );

  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE token = $1', [token]);
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
