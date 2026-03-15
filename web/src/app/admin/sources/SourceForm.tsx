'use client';

import { useState }  from 'react';
import { useRouter } from 'next/navigation';

interface SourceData {
  name?: string; domain?: string; rssUrl?: string; scrapeSelector?: string;
  dateSelector?: string; ingestionMethod?: string; archiveFallback?: boolean;
  color?: string; font?: string; biasDefault?: string; category?: string;
  priority?: number; crawlIntervalMins?: number; maxAgeDays?: number;
  active?: boolean; discoveryNotes?: string;
}

interface Props {
  initial?: SourceData & { id?: number };
  mode: 'create' | 'edit';
}

export default function SourceForm({ initial, mode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<SourceData>({
    name:              initial?.name              ?? '',
    domain:            initial?.domain            ?? '',
    rssUrl:            initial?.rssUrl            ?? '',
    scrapeSelector:    initial?.scrapeSelector    ?? '',
    dateSelector:      initial?.dateSelector      ?? '',
    ingestionMethod:   initial?.ingestionMethod   ?? 'rss',
    archiveFallback:   initial?.archiveFallback   ?? false,
    color:             initial?.color             ?? '#333333',
    font:              initial?.font              ?? 'Georgia, serif',
    biasDefault:       initial?.biasDefault       ?? '',
    category:          initial?.category          ?? 'general',
    priority:          initial?.priority          ?? 5,
    crawlIntervalMins: initial?.crawlIntervalMins ?? 60,
    maxAgeDays:        initial?.maxAgeDays        ?? 2,
    active:            initial?.active            ?? true,
    discoveryNotes:    initial?.discoveryNotes    ?? '',
  });
  const [discovering, setDiscovering] = useState(false);
  const [error,       setError]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const set = (key: keyof SourceData, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  const discover = async () => {
    if (!form.domain) return;
    setDiscovering(true);
    try {
      const res  = await fetch(`/api/sources/discover?domain=${encodeURIComponent(form.domain)}`);
      const data = await res.json() as {
        rssUrl?: string; ingestionMethod?: string;
        contentSelector?: string; dateSelector?: string; notes?: string[];
      };
      if (data.rssUrl)           set('rssUrl',           data.rssUrl);
      if (data.ingestionMethod)  set('ingestionMethod',  data.ingestionMethod);
      if (data.contentSelector)  set('scrapeSelector',   data.contentSelector);
      if (data.dateSelector)     set('dateSelector',     data.dateSelector);
      if (data.notes)            set('discoveryNotes',   data.notes.join('\n'));
    } catch {
      setError('Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url    = mode === 'create' ? '/api/sources' : `/api/sources/${initial?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? 'Save failed');
      } else {
        router.push('/admin/sources');
        router.refresh();
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = 'w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-ink';
  const labelCls = 'block text-xs uppercase tracking-widest text-gray-600 mb-1';

  return (
    <form onSubmit={submit} className="space-y-6 max-w-2xl">
      {error && (
        <p className="text-red-600 text-sm border border-red-200 bg-red-50 px-3 py-2">{error}</p>
      )}

      {/* Domain + discovery */}
      <div className="grid grid-cols-3 gap-2 items-end">
        <div className="col-span-2">
          <label className={labelCls}>Domain *</label>
          <input required className={fieldCls} value={form.domain}
            onChange={e => set('domain', e.target.value)}
            placeholder="e.g. example.com" />
        </div>
        <button type="button" onClick={discover} disabled={discovering || !form.domain}
          className="bg-gray-700 text-white px-3 py-2 text-sm hover:bg-gray-600 disabled:opacity-40">
          {discovering ? 'Discovering…' : 'Auto-detect'}
        </button>
      </div>

      <div>
        <label className={labelCls}>Display Name *</label>
        <input required className={fieldCls} value={form.name}
          onChange={e => set('name', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Category</label>
          <select className={fieldCls} value={form.category}
            onChange={e => set('category', e.target.value)}>
            {['general','tech','business','homelab'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority (1–10)</label>
          <input type="number" min={1} max={10} className={fieldCls}
            value={form.priority} onChange={e => set('priority', parseInt(e.target.value,10))} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Ingestion Method</label>
        <select className={fieldCls} value={form.ingestionMethod}
          onChange={e => set('ingestionMethod', e.target.value)}>
          {['rss','scrape','archive','api'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>RSS Feed URL</label>
        <input type="url" className={fieldCls} value={form.rssUrl}
          onChange={e => set('rssUrl', e.target.value)} placeholder="https://..." />
      </div>

      <div>
        <label className={labelCls}>Content CSS Selector</label>
        <input className={fieldCls} value={form.scrapeSelector}
          onChange={e => set('scrapeSelector', e.target.value)} placeholder="e.g. article, .article-body" />
      </div>

      <div>
        <label className={labelCls}>Date CSS Selector</label>
        <input className={fieldCls} value={form.dateSelector}
          onChange={e => set('dateSelector', e.target.value)} placeholder="e.g. time[datetime]" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Crawl Interval (mins)</label>
          <input type="number" min={5} className={fieldCls}
            value={form.crawlIntervalMins}
            onChange={e => set('crawlIntervalMins', parseInt(e.target.value,10))} />
        </div>
        <div>
          <label className={labelCls}>Max Age (days)</label>
          <input type="number" min={1} max={30} className={fieldCls}
            value={form.maxAgeDays}
            onChange={e => set('maxAgeDays', parseInt(e.target.value,10))} />
        </div>
        <div>
          <label className={labelCls}>Accent Colour</label>
          <input type="color" className="w-full h-10 border border-gray-300 cursor-pointer"
            value={form.color} onChange={e => set('color', e.target.value)} />
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.archiveFallback}
            onChange={e => set('archiveFallback', e.target.checked)} />
          Use archive fallback
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.active}
            onChange={e => set('active', e.target.checked)} />
          Active
        </label>
      </div>

      {form.discoveryNotes && (
        <div>
          <label className={labelCls}>Discovery Notes</label>
          <textarea rows={4} readOnly className={`${fieldCls} bg-gray-50 text-gray-600`}
            value={form.discoveryNotes} />
        </div>
      )}

      <button type="submit" disabled={saving}
        className="bg-ink text-white px-6 py-2 text-sm uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50">
        {saving ? 'Saving…' : mode === 'create' ? 'Add Source' : 'Save Changes'}
      </button>
    </form>
  );
}
