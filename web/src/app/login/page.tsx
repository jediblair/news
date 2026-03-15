'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router  = useRouter();
  const [tab,   setTab]   = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password: pass }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; role?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Something went wrong');
      } else {
        router.push(data.role === 'admin' ? '/admin' : '/');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-newsprint px-4">
      <div className="w-full max-w-sm border-2 border-ink bg-white shadow-sm p-8">
        {/* Masthead mini */}
        <div className="text-center border-b-2 border-ink pb-4 mb-6">
          <p className="masthead-title text-2xl">The Daily Digest</p>
          <p className="text-xs tracking-widest uppercase mt-1">Account Access</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200 mb-6">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold tracking-wide uppercase cursor-pointer
                ${tab === t ? 'border-b-2 border-ink text-ink' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {t === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-gray-600 block mb-1">
              Email
            </label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-gray-600 block mb-1">
              Password {tab === 'register' && <span className="normal-case">(min 8 characters)</span>}
            </label>
            <input
              type="password" required minLength={tab === 'register' ? 8 : 1}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={pass} onChange={e => setPass(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm border border-red-200 bg-red-50 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-ink text-white py-2 text-sm uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {tab === 'register' && (
          <p className="text-xs text-gray-500 mt-4 text-center">
            First registered account becomes administrator.
          </p>
        )}
      </div>
    </div>
  );
}
