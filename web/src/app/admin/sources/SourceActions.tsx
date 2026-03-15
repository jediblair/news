'use client';

import { useRouter } from 'next/navigation';
import { useState  } from 'react';
import Link          from 'next/link';

export default function SourceActions({ sourceId, active }: { sourceId: string; active: boolean }) {
  const router  = useRouter();
  const [busy, setBusy] = useState(false);

  const crawlNow = async () => {
    setBusy(true);
    await fetch(`/api/sources/${sourceId}/crawl`, { method: 'POST' });
    setBusy(false);
    router.refresh();
  };

  const deleteSource = async () => {
    if (!confirm('Delete this source and all its articles?')) return;
    setBusy(true);
    await fetch(`/api/sources/${sourceId}`, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <Link href={`/admin/sources/${sourceId}`} className="text-blue-600 hover:underline">Edit</Link>
      <button
        onClick={crawlNow} disabled={busy}
        className="text-green-700 hover:underline disabled:opacity-40"
      >
        {busy ? '…' : 'Crawl Now'}
      </button>
      <button
        onClick={deleteSource} disabled={busy}
        className="text-red-600 hover:underline disabled:opacity-40"
      >
        Delete
      </button>
    </div>
  );
}
