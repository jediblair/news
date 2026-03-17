import { notFound }  from 'next/navigation';
import { db }         from '@/lib/db';
import Masthead       from '@/app/components/Masthead';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

interface ArticleRow {
  id:             string;
  title:          string;
  summary:        string | null;
  content:        string | null;
  url:            string;
  author:         string | null;
  published_date: string | null;
  bias_tag:       string | null;
  trope_score:    number | null;
  content_tags:   string[];
  source_name:    string;
  source_color:   string;
  source_domain:  string;
}

const BIAS_COLOURS: Record<string, string> = {
  'left':         '#2563eb',
  'center-left':  '#60a5fa',
  'center':       '#6b7280',
  'center-right': '#fb923c',
  'right':        '#dc2626',
};

function tropeColor(score: number): string {
  if (score < 10) return '#d97706';
  if (score < 25) return '#ea580c';
  return '#dc2626';
}

function formatDate(raw: string | null) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Render stored plain text as readable paragraphs.
 * The classifier strips HTML to plain text, so we just split on blank lines / long runs of whitespace.
 */
function renderContent(text: string) {
  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0);

  // If there are no paragraph breaks, chunk by sentence groups (~4 sentences)
  if (paragraphs.length === 1 && text.length > 400) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    const grouped: string[] = [];
    for (let i = 0; i < sentences.length; i += 4) {
      grouped.push(sentences.slice(i, i + 4).join(' ').trim());
    }
    return grouped;
  }

  return paragraphs;
}

export default async function ArticlePage({ params }: Props) {
  // Validate UUID format to prevent injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
    notFound();
  }

  const { rows } = await db.query<ArticleRow>(
    `SELECT
       a.id, a.title, a.summary, a.content, a.url,
       a.author, COALESCE(a.published_date, a.inferred_date, a.created_at) AS published_date,
       a.bias_tag, a.trope_score,
       COALESCE(a.content_tags, '{}') AS content_tags,
       s.name AS source_name, s.color AS source_color, s.domain AS source_domain
     FROM articles a
     JOIN sources s ON a.source_id = s.id
     WHERE a.id = $1`,
    [params.id],
  );

  if (rows.length === 0) notFound();
  const article = rows[0];

  const body       = article.content ?? article.summary;
  const paragraphs = body ? renderContent(body) : [];
  const dateStr    = formatDate(article.published_date);
  const showBias   = article.bias_tag && article.bias_tag !== 'unknown';
  const biasColor  = showBias ? (BIAS_COLOURS[article.bias_tag!] ?? '#6b7280') : null;
  const tags       = article.content_tags.filter(Boolean);

  return (
    <>
      <Masthead date={new Date()} />

      <div className="page-wrap" style={{ maxWidth: '860px' }}>
        {/* Back link */}
        <div style={{ padding: '1rem 0 0.5rem', borderBottom: '1px solid var(--column-rule)' }}>
          <a href="/" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)', textDecoration: 'none' }}>
            ← Front page
          </a>
        </div>

        <article style={{ padding: '2rem 0' }}>
          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span
              className="badge text-white"
              style={{ backgroundColor: article.source_color, fontSize: '0.62rem' }}
            >
              {article.source_name}
            </span>

            {tags.map(tag => (
              <span key={tag} className="badge" style={{ backgroundColor: '#e9ecef', color: '#495057', fontSize: '0.58rem' }}>
                {tag}
              </span>
            ))}

            {showBias && biasColor && (
              <span className="badge" style={{ backgroundColor: biasColor + '22', color: biasColor, fontSize: '0.58rem' }}>
                {article.bias_tag}
              </span>
            )}

            {article.trope_score !== null && article.trope_score > 0 && (
              <span
                className="badge"
                title="AI writing trope score — higher means more AI-style language patterns detected"
                style={{ backgroundColor: tropeColor(article.trope_score) + '22', color: tropeColor(article.trope_score), fontSize: '0.58rem' }}
              >
                AI {article.trope_score}%
              </span>
            )}
          </div>

          {/* Headline */}
          <h1 className="headline" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', lineHeight: '1.2', marginBottom: '0.5rem' }}>
            {article.title}
          </h1>

          {/* Byline */}
          <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '1.5rem', borderBottom: '1px solid var(--column-rule)', paddingBottom: '0.75rem' }}>
            {article.author && <span>By {article.author} &nbsp;·&nbsp; </span>}
            {dateStr && <span>{dateStr} &nbsp;·&nbsp; </span>}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              {article.source_domain} ↗
            </a>
          </p>

          {/* Body */}
          {paragraphs.length > 0 ? (
            <div style={{ fontSize: '1.05rem', lineHeight: '1.75', fontFamily: 'Georgia, serif' }}>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ marginBottom: '1.1rem' }}>{p}</p>
              ))}
            </div>
          ) : (
            <p style={{ color: '#888', fontStyle: 'italic' }}>
              No local copy available.{' '}
              <a href={article.url} target="_blank" rel="noopener noreferrer">Read at {article.source_domain} ↗</a>
            </p>
          )}

          {/* Footer: original link */}
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--column-rule)', fontSize: '0.8rem' }}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline-secondary"
            >
              Read original at {article.source_domain} ↗
            </a>
          </div>
        </article>
      </div>
    </>
  );
}
