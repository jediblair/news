export const dynamic = 'force-dynamic';
import { db }     from '@/lib/db';
import { notFound } from 'next/navigation';
import SourceForm   from '../SourceForm';

interface Props { params: Promise<{ id: string }> }

export default async function EditSourcePage({ params }: Props) {
  const { id } = await params;
  const { rows } = await db.query('SELECT * FROM sources WHERE id = $1', [id]);
  if (!rows[0]) notFound();

  const s = rows[0] as Record<string, unknown>;
  const initial = {
    id:                Number(s.id),
    name:              String(s.name),
    domain:            String(s.domain),
    rssUrl:            s.rss_url         ? String(s.rss_url)          : '',
    scrapeSelector:    s.scrape_selector ? String(s.scrape_selector)  : '',
    dateSelector:      s.date_selector   ? String(s.date_selector)    : '',
    ingestionMethod:   String(s.ingestion_method),
    archiveFallback:   Boolean(s.archive_fallback),
    color:             String(s.color),
    font:              String(s.font),
    biasDefault:       s.bias_default    ? String(s.bias_default)     : '',
    category:          String(s.category),
    priority:          Number(s.priority),
    crawlIntervalMins: Number(s.crawl_interval_mins),
    maxAgeDays:        Number(s.max_age_days),
    active:            Boolean(s.active),
    discoveryNotes:    s.discovery_notes ? String(s.discovery_notes)  : '',
  };

  return (
    <div className="space-y-6">
      <h1 className="headline text-3xl font-bold">Edit Source — {initial.name}</h1>
      <SourceForm mode="edit" initial={initial} />
    </div>
  );
}
