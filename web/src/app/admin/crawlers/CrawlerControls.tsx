'use client';

import { useState  } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  sourceId?:    string;
  crawlStatus?: string;
}

export default function CrawlerControls({ sourceId, crawlStatus }: Props) {
  const router     = useRouter();
  const [busy, setBusy] = useState(false);

  // If no sourceId, render a "Crawl All" button
  if (!sourceId) {
    const crawlAll = async () => {
      setBusy(true);
      await fetch('/api/crawlers/crawl-all', { method: 'POST' });
      setBusy(false);
      router.refresh();
    };
    return (
      <button
        onClick={crawlAll} disabled={busy}
        className="bg-ink text-white px-4 py-2 text-sm uppercase tracking-wide hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? 'Queuing…' : 'Crawl All Now'}
      </button>
    );
  }

  const crawlNow = async () => {
    setBusy(true);
    await fetch(`/api/sources/${sourceId}/crawl`, { method: 'POST' });
    setBusy(false);
    router.refresh();
  };

  return (
    <button
      onClick={crawlNow}
      disabled={busy || crawlStatus === 'running'}
      className="text-sm text-green-700 hover:underline disabled:opacity-40"
    >
      {crawlStatus === 'running' ? 'Running…' : busy ? '…' : 'Crawl Now'}
    </button>
  );
}
