import * as cheerio from 'cheerio';
import { safeFetch } from './fetcher';

export interface DiscoveryResult {
  rssUrl:          string | null;
  ingestionMethod: 'rss' | 'scrape';
  contentSelector: string | null;
  dateSelector:    string | null;
  notes:           string[];
}

// Common RSS feed paths to probe
const RSS_PATHS = [
  '/rss',
  '/rss.xml',
  '/feed',
  '/feed.xml',
  '/feed/rss',
  '/rss/news.rss',
  '/atom.xml',
  '/news/rss',
  '/index.xml',
  '/feeds/all.rss.xml',
];

// Common content selectors for news sites
const CONTENT_SELECTORS = [
  'article',
  '[class*="article-body"]',
  '[class*="article__body"]',
  '[class*="story-body"]',
  '[class*="post-content"]',
  '[class*="content__article"]',
  '.entry-content',
  '.article-content',
  'main',
];

// Common date selectors
const DATE_SELECTORS = [
  'time[datetime]',
  '[class*="publish-date"]',
  '[class*="article-date"]',
  '[class*="posted-on"]',
  'meta[property="article:published_time"]',
  '.date',
];

export async function discoverSource(domain: string): Promise<DiscoveryResult> {
  const base  = `https://${domain}`;
  const notes: string[] = [];
  let rssUrl: string | null = null;

  // 1. Fetch homepage, look for <link type="application/rss+xml">
  try {
    const { html } = await safeFetch(base);
    const $        = cheerio.load(html);

    const linkTag = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first();
    if (linkTag.length) {
      const href = linkTag.attr('href');
      if (href) {
        rssUrl = href.startsWith('http') ? href : `${base}${href}`;
        notes.push(`Found RSS link tag in HTML: ${rssUrl}`);
      }
    }

    // 2. Try common RSS paths if not found in link tag
    if (!rssUrl) {
      for (const path of RSS_PATHS) {
        try {
          const candidate = `${base}${path}`;
          const resp      = await safeFetch(candidate);
          if (resp.status === 200 && (resp.html.includes('<rss') || resp.html.includes('<feed'))) {
            rssUrl = candidate;
            notes.push(`Found RSS at common path: ${rssUrl}`);
            break;
          }
        } catch { /* try next */ }
      }
    }

    // 3. Probe content selectors on homepage
    let contentSelector: string | null = null;
    let dateSelector: string | null    = null;

    for (const sel of CONTENT_SELECTORS) {
      if ($(sel).length > 0) {
        contentSelector = sel;
        notes.push(`Detected content selector: ${sel}`);
        break;
      }
    }

    for (const sel of DATE_SELECTORS) {
      if ($(sel).length > 0) {
        dateSelector = sel;
        notes.push(`Detected date selector: ${sel}`);
        break;
      }
    }

    const ingestionMethod = rssUrl ? 'rss' : 'scrape';
    if (!rssUrl) notes.push('No RSS feed found — will use scraping');

    return { rssUrl, ingestionMethod, contentSelector, dateSelector, notes };
  } catch (err) {
    notes.push(`Discovery failed: ${(err as Error).message}`);
    return { rssUrl: null, ingestionMethod: 'scrape', contentSelector: null, dateSelector: null, notes };
  }
}
