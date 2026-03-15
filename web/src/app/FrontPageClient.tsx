'use client';

import { useState, useCallback } from 'react';
import Link                       from 'next/link';
import ArticleCard, { Article }   from './components/ArticleCard';
import type { SidebarArticle }    from './page';

const PAGE_SIZE = 30;

function relativeTime(val: string | null): string {
  if (!val) return '';
  const diff = Date.now() - new Date(val).getTime();
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  initial:      Article[];
  breaking:     Article[];
  date:         string;
  prevDay:      string | null;
  nextDay:      string | null;
  iranArticles?: SidebarArticle[];
}

export default function FrontPageClient({ initial, breaking, date, prevDay, nextDay, iranArticles = [] }: Props) {
  const [articles, setArticles] = useState<Article[]>(initial);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [exhausted, setExhausted] = useState(initial.length < PAGE_SIZE);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      date,
      page:  String(page + 1),
      limit: String(PAGE_SIZE),
    });
    const res  = await fetch(`/api/articles?${params}`);
    const json = await res.json();
    const data: Article[] = json.articles ?? [];
    if (data.length < PAGE_SIZE) setExhausted(true);
    setArticles(prev => [...prev, ...data]);
    setPage(p => p + 1);
    setLoading(false);
  }, [date, page]);

  return (
    <div className="container-fluid px-3 py-3" style={{ maxWidth: '1400px', margin: '0 auto' }}>

      {/* Breaking news banner */}
      {breaking.length > 0 && (
        <div className="alert alert-danger d-flex align-items-center py-2 mb-3 border-0" role="alert">
          <span className="badge bg-danger me-2 flex-shrink-0">BREAKING</span>
          <a
            href={breaking[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dark fw-semibold text-decoration-none"
          >
            {breaking[0].title}
          </a>
        </div>
      )}

      {/* Two-column: articles + Iran sidebar */}
      <div className="row g-4">

        {/* Main article grid */}
        <div className="col-lg-9">
          <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
            {articles.map(article => (
              <div key={article.id} className="col">
                <ArticleCard article={article} />
              </div>
            ))}
            {articles.length === 0 && (
              <div className="col-12 text-center text-muted py-5">
                <p className="mb-0">No articles found for {date}.</p>
              </div>
            )}
          </div>

          {/* Load more */}
          {!exhausted && (
            <div className="text-center mt-4">
              <button
                className="btn btn-outline-secondary px-4"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Loading…
                  </>
                ) : 'Load more stories'}
              </button>
            </div>
          )}
        </div>

        {/* Iran war sidebar */}
        <div className="col-lg-3">
          <div className="card border-0 shadow-sm" style={{ borderRadius: '8px', position: 'sticky', top: '1rem' }}>
            <div
              className="card-header border-0 text-white fw-bold"
              style={{ backgroundColor: '#b91c1c', borderRadius: '8px 8px 0 0', fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              Iran War Coverage
            </div>
            <div className="card-body p-0">
              {iranArticles.length === 0 ? (
                <p className="text-muted text-center py-4 mb-0" style={{ fontSize: '0.8rem' }}>
                  No Iran coverage found in the last 7 days.
                </p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {iranArticles.map((a, i) => (
                    <li
                      key={a.id}
                      className={i < iranArticles.length - 1 ? 'border-bottom' : ''}
                      style={{ padding: '0.65rem 0.85rem' }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span
                          className="badge text-white"
                          style={{ backgroundColor: a.source_color, fontSize: '0.55rem', flexShrink: 0 }}
                        >
                          {a.source_name}
                        </span>
                        {a.published_date && (
                          <span className="text-muted" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
                            {relativeTime(a.published_date)}
                          </span>
                        )}
                      </div>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-decoration-none"
                        style={{ color: '#1a1a1a', fontSize: '0.8rem', lineHeight: '1.35', display: 'block', fontWeight: 500 }}
                      >
                        {a.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

      </div>{/* end two-column row */}

      {/* Day navigation */}
      <nav className="d-flex justify-content-between align-items-center border-top mt-4 pt-3">
        {prevDay ? (
          <Link href={`/day/${prevDay}`} className="btn btn-sm btn-outline-secondary">
            ← {prevDay}
          </Link>
        ) : <span />}
        <span className="text-muted small">{date}</span>
        {nextDay ? (
          <Link href={`/day/${nextDay}`} className="btn btn-sm btn-outline-secondary">
            {nextDay} →
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}

