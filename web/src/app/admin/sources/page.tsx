export const dynamic = 'force-dynamic';
import { db }  from '@/lib/db';
import Link     from 'next/link';
import SourceActions from './SourceActions';

export default async function SourcesPage() {
  const { rows } = await db.query(
    `SELECT s.*,
       (SELECT COUNT(*) FROM articles a WHERE a.source_id = s.id) AS article_count
     FROM sources s ORDER BY s.priority DESC, s.name`,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="headline text-3xl font-bold">News Sources</h1>
        <Link
          href="/admin/sources/new"
          className="bg-ink text-white px-4 py-2 text-sm uppercase tracking-wide hover:bg-gray-800"
        >
          + Add Source
        </Link>
      </div>

      <div className="bg-white border border-gray-200 overflow-auto">
        <table className="w-full admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Domain</th><th>Category</th><th>Method</th>
              <th>Priority</th><th>Articles</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: Record<string,unknown>) => (
              <tr key={String(s.id)} className={s.active ? '' : 'opacity-40'}>
                <td className="font-medium">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: String(s.color) }}
                  />
                  {String(s.name)}
                </td>
                <td className="text-gray-500">{String(s.domain)}</td>
                <td className="capitalize">{String(s.category)}</td>
                <td>{String(s.ingestion_method)}</td>
                <td>{String(s.priority)}</td>
                <td>{String(s.article_count)}</td>
                <td>
                  <span className={
                    s.crawl_status === 'running' ? 'status-running' :
                    s.crawl_status === 'error'   ? 'status-error'   : 'status-idle'
                  } />
                  {' '}{String(s.crawl_status)}
                </td>
                <td>
                  <SourceActions sourceId={String(s.id)} active={Boolean(s.active)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
