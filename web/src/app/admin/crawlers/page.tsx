export const dynamic = 'force-dynamic';
import { db }   from '@/lib/db';
import CrawlerControls from './CrawlerControls';

export default async function CrawlersPage() {
  const { rows: sources } = await db.query(
    `SELECT s.id, s.name, s.crawl_status, s.last_crawl, s.next_crawl, s.active,
       (SELECT COUNT(*) FROM crawl_jobs j WHERE j.source_id = s.id) AS job_count,
       (SELECT COUNT(*) FROM crawl_jobs j WHERE j.source_id = s.id AND j.status = 'failed') AS fail_count
     FROM sources s ORDER BY s.priority DESC, s.name`,
  );

  const { rows: recentJobs } = await db.query(
    `SELECT j.*, s.name AS source_name
     FROM crawl_jobs j JOIN sources s ON j.source_id = s.id
     ORDER BY j.created_at DESC LIMIT 50`,
  );

  const fmt = (ts: unknown) => ts ? new Date(String(ts)).toLocaleString() : '—';
  const statusDot = (s: string) =>
    s === 'running' ? 'status-running' : s === 'error' ? 'status-error' : 'status-idle';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="headline text-3xl font-bold">Crawler Status</h1>
        <CrawlerControls />
      </div>

      {/* Per-source status */}
      <div className="bg-white border border-gray-200 overflow-auto">
        <table className="w-full admin-table">
          <thead>
            <tr>
              <th>Source</th><th>Status</th><th>Last Crawl</th>
              <th>Next Crawl</th><th>Jobs</th><th>Failures</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s: Record<string,unknown>) => (
              <tr key={String(s.id)} className={s.active ? '' : 'opacity-40'}>
                <td className="font-medium">{String(s.name)}</td>
                <td>
                  <span className={statusDot(String(s.crawl_status))} />{' '}
                  {String(s.crawl_status)}
                </td>
                <td className="text-xs">{fmt(s.last_crawl)}</td>
                <td className="text-xs">{fmt(s.next_crawl)}</td>
                <td>{String(s.job_count)}</td>
                <td className={Number(s.fail_count) > 0 ? 'text-red-600 font-semibold' : ''}>
                  {String(s.fail_count)}
                </td>
                <td>
                  <CrawlerControls sourceId={String(s.id)} crawlStatus={String(s.crawl_status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent jobs log */}
      <div>
        <h2 className="headline text-xl font-bold mb-3">Recent Jobs</h2>
        <div className="bg-white border border-gray-200 overflow-auto max-h-96">
          <table className="w-full admin-table">
            <thead>
              <tr>
                <th>Source</th><th>Status</th><th>Triggered</th>
                <th>Found</th><th>New</th><th>Duration</th><th>Error</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j: Record<string,unknown>) => {
                const start    = j.started_at   ? new Date(String(j.started_at)).getTime()   : null;
                const complete = j.completed_at ? new Date(String(j.completed_at)).getTime() : null;
                const duration = start && complete ? `${Math.round((complete - start)/1000)}s` : '—';
                return (
                  <tr key={String(j.id)}>
                    <td>{String(j.source_name)}</td>
                    <td>
                      <span className={statusDot(String(j.status))} /> {String(j.status)}
                    </td>
                    <td>{String(j.triggered_by)}</td>
                    <td>{String(j.articles_found   ?? 0)}</td>
                    <td>{String(j.articles_new     ?? 0)}</td>
                    <td className="text-xs">{duration}</td>
                    <td className="text-xs text-red-600 max-w-xs truncate">
                      {String(j.error_message ?? '')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
