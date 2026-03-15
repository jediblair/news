'use client';

import { useState } from 'react';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  last_login: string | null;
}

export default function UserActions({ user, currentUserId, onRefresh }: {
  user: User;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSelf = user.id === currentUserId;

  const promote = async () => {
    setBusy(true); setError('');
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: user.role === 'admin' ? 'user' : 'admin' }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) setError(data.error ?? 'Failed');
    else onRefresh();
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    setBusy(true); setError('');
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    const data = await res.json() as { error?: string };
    if (!res.ok) setError(data.error ?? 'Failed');
    else onRefresh();
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-red-600 text-xs">{error}</span>}
      {!isSelf && (
        <>
          <button
            onClick={promote}
            disabled={busy}
            className="text-xs border border-ink px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
          >
            {user.role === 'admin' ? 'Demote to user' : 'Make admin'}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="text-xs border border-red-400 text-red-600 px-2 py-1 hover:bg-red-50 disabled:opacity-40"
          >
            Delete
          </button>
        </>
      )}
      {isSelf && <span className="text-xs text-gray-400 italic">you</span>}
    </div>
  );
}
