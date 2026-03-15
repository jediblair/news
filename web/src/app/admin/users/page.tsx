'use client';

import { useEffect, useState, useCallback } from 'react';
import UserActions from './UserActions';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  last_login: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, meRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/auth/me'),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json() as User[]);
    if (meRes.ok) {
      const { user } = await meRes.json() as { user: { id: string } };
      setCurrentUserId(user.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className="space-y-6">
      <h1 className="headline text-3xl font-bold">User Management</h1>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                      u.role === 'admin' ? 'bg-ink text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(u.last_login)}</td>
                  <td className="px-4 py-3">
                    <UserActions user={u} currentUserId={currentUserId} onRefresh={load} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-gray-400">{users.length} user{users.length !== 1 ? 's' : ''} total</p>
        </div>
      )}
    </div>
  );
}
