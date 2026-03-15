'use client';

import Link      from 'next/link';
import SourceBadge from './SourceBadge';

export interface Article {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  published_date: string | null;
  is_breaking: boolean;
  bias_tag: string | null;
  source_name: string;
  source_color: string;
}

interface ArticleCardProps {
  article: Article;
  /** 'lead' = big top story, 'secondary' = medium story, 'brief' = compact list item */
  variant?: 'lead' | 'secondary' | 'brief';
}

const BIAS_COLOURS: Record<string, string> = {
  'left':         '#2563eb',
  'center-left':  '#60a5fa',
  'center':       '#6b7280',
  'center-right': '#fb923c',
  'right':        '#dc2626',
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ArticleCard({ article, variant = 'secondary' }: ArticleCardProps) {
  const biasColor = article.bias_tag ? (BIAS_COLOURS[article.bias_tag] ?? '#6b7280') : undefined;

  if (variant === 'brief') {
    return (
      <li className="article-brief">
        <SourceBadge name={article.source_name} color={article.source_color} />
        {' '}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="brief-title">
          {article.title}
        </a>
        <span className="article-time">{article.published_date ? relativeTime(article.published_date) : ''}</span>
      </li>
    );
  }

  return (
    <article className={`article-card article-card--${variant}`}>
      {article.is_breaking && (
        <span className="breaking-label">Breaking</span>
      )}
      {article.image_url && variant === 'lead' && (
        /* Images are proxied via /api/image to hide user IPs */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/image?url=${encodeURIComponent(article.image_url)}`}
          alt=""
          className="article-image"
        />
      )}
      <div className="article-meta">
        <SourceBadge name={article.source_name} color={article.source_color} />
        {biasColor && (
          <span className="bias-tag" style={{ color: biasColor }} title={`Bias: ${article.bias_tag}`}>
            {article.bias_tag}
          </span>
        )}
        <span className="article-time">{article.published_date ? relativeTime(article.published_date) : ''}</span>
      </div>
      <h2 className={`article-headline article-headline--${variant}`}>
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {article.title}
        </a>
      </h2>
      {article.author && <p className="article-byline">By {article.author}</p>}
      {article.summary && (
        <p className="article-summary">{article.summary}</p>
      )}
    </article>
  );
}
