export const dynamic = 'force-dynamic';
import { db }  from '@/lib/db';
import Link     from 'next/link';

interface Stats {
  articles: string; sources: string; unclassified: string; jobs_today: string;
}

export default async function AdminDashboard() {
  const { rows } = await db.query<Stats>(
    `SELECT
       (SELECT COUNT(*) FROM articles)                                AS articles,
       (SELECT COUNT(*) FROM sources  WHERE active = TRUE)           AS sources,
       (SELECT COUNT(*) FROM articles WHERE classified = FALSE)       AS unclassified,
       (SELECT COUNT(*) FROM crawl_jobs WHERE created_at > NOW() - INTERVAL '24 hours') AS jobs_today`,
  );
  const stats = rows[0];

  const { rows: recentJobs } = await db.query(
    `SELECT j.*, s.name AS source_name
     FROM crawl_jobs j JOIN sources s ON j.source_id = s.id
     ORDER BY j.created_at DESC LIMIT 10`,
  );

  const statusClass = (s: string) => {
    if (s === 'running')   return 'status-running';
    if (s === 'error' || s === 'failed') return 'status-error';
    return 'status-idle';
  };

  return (
    <div className="space-y-8">
      <h1 className="headline text-3xl font-bold">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Articles',  value: stats.articles },
          { label: 'Active Sources',  value: stats.sources },
          { label: 'Unclassified',    value: stats.unclassified },
          { label: 'Jobs (24h)',       value: stats.jobs_today },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded p-4">
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link href="/admin/sources" className="bg-ink text-white px-4 py-2 text-sm uppercase tracking-wide hover:bg-gray-800">
          Manage Sources
        </Link>
        <Link href="/admin/crawlers" className="border border-ink text-ink px-4 py-2 text-sm uppercase tracking-wide hover:bg-gray-100">
          Crawler Status
        </Link>
      </div>

      {/* Recent jobs */}
      <div>
        <h2 className="headline text-xl font-bold mb-3">Recent Crawl Jobs</h2>
        <div className="bg-white border border-gray-200 overflow-auto">
          <table className="w-full admin-table">
            <thead>
              <tr>
                <th>Source</th><th>Status</th><th>Triggered</th>
                <th>Found</th><th>New</th><th>Started</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j: Record<string,unknown>) => (
                <tr key={String(j.id)}>
                  <td>{String(j.source_name)}</td>
                  <td>
                    <span className={statusClass(String(j.status))} />{' '}
                    {String(j.status)}
                  </td>
                  <td>{String(j.triggered_by)}</td>
                  <td>{String(j.articles_found ?? 0)}</td>
                  <td>{String(j.articles_new   ?? 0)}</td>
                  <td className="text-xs text-gray-500">
                    {j.started_at ? new Date(String(j.started_at)).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              {recentJobs.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-4">No jobs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
