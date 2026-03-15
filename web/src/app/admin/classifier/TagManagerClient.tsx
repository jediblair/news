'use client';

import { useState } from 'react';

interface Props {
  initialTags: string[];
}

export default function TagManagerClient({ initialTags }: Props) {
  const [tags, setTags]     = useState<string[]>(initialTags);
  const [input, setInput]   = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  function addTag() {
    const tag = input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!tag || tags.includes(tag)) { setInput(''); return; }
    setTags(prev => [...prev, tag].sort());
    setInput('');
    setSaved(false);
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'classifier_tags', value: tags }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? 'Save failed');
      }
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 mb-4">
          These tags are used by the AI classifier to label every article&apos;s topics.
          Changes take effect on the next classification batch (within 30 seconds).
          Existing articles won&apos;t be re-classified automatically.
        </p>

        {/* Current tags */}
        <div className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded p-4 min-h-[80px]">
          {tags.sort().map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-mono"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 text-gray-400 hover:text-red-600 font-bold leading-none"
                title={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          {tags.length === 0 && <span className="text-gray-400 text-sm">No tags configured</span>}
        </div>
      </div>

      {/* Add tag */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTag()}
          placeholder="Add tag (e.g. iraq, nato, sanctions)"
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={30}
        />
        <button
          onClick={addTag}
          className="bg-gray-800 text-white px-4 py-2 text-sm rounded hover:bg-gray-700"
        >
          Add
        </button>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-ink text-white px-6 py-2 text-sm uppercase tracking-wide hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save tag list'}
        </button>
        {saved  && <span className="text-green-600 text-sm">Saved successfully.</span>}
        {error  && <span className="text-red-600 text-sm">{error}</span>}
        <span className="text-gray-400 text-sm ml-auto">{tags.length} tags</span>
      </div>

      <div className="border-t pt-4 text-sm text-gray-500">
        <strong>Tip:</strong> Use short lowercase words or hyphenated phrases (e.g.{' '}
        <code className="bg-gray-100 px-1 rounded">middle-east</code>,{' '}
        <code className="bg-gray-100 px-1 rounded">iran</code>,{' '}
        <code className="bg-gray-100 px-1 rounded">nato</code>).
        The classifier will pick 1–4 matching tags per article.
      </div>
    </div>
  );
}
