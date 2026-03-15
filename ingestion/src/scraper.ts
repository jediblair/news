import * as cheerio from 'cheerio';
import { safeFetch } from './fetcher';
import { sanitizeContent, sanitizeUrl, toPlainText } from './sanitize';
import type { ParsedArticle } from './feeds';

/**
 * Scrape a single article page using provided CSS selectors.
 */
export async function scrapeArticle(
  url:             string,
  contentSelector: string,
  dateSelector?:   string,
): Promise<Partial<ParsedArticle>> {
  const { html } = await safeFetch(url);
  const $        = cheerio.load(html);

  const rawContent = $(contentSelector).html() ?? '';
  const content    = sanitizeContent(rawContent);

  let publishedDate: Date | null = null;
  if (dateSelector) {
    const dateText = $(dateSelector).attr('datetime') ?? $(dateSelector).text();
    const parsed   = Date.parse(dateText);
    if (!isNaN(parsed)) publishedDate = new Date(parsed);
  }

  // Try common date patterns if selector didn't work
  if (!publishedDate) {
    const dateEl = $('[datetime]').first();
    if (dateEl.length) {
      const parsed = Date.parse(dateEl.attr('datetime') ?? '');
      if (!isNaN(parsed)) publishedDate = new Date(parsed);
    }
  }

  // Image — og:image or first article img
  const ogImage  = $('meta[property="og:image"]').attr('content');
  const imageUrl = sanitizeUrl(ogImage ?? $(`${contentSelector} img`).first().attr('src') ?? null);

  // Author — common meta tags
  const author =
    $('meta[name="author"]').attr('content') ??
    $('[rel="author"]').first().text().trim() ??
    null;

  // Title from og:title or <title>
  const title =
    $('meta[property="og:title"]').attr('content') ??
    $('title').text().trim() ??
    '';

  const summary = toPlainText(
    $('meta[name="description"]').attr('content') ??
    $('meta[property="og:description"]').attr('content') ??
    '',
  ).slice(0, 500) || null;

  return { title, content, summary, imageUrl: imageUrl ?? null, author, publishedDate };
}

/**
 * Discover article links from a source homepage.
 * Returns absolute URLs likely to be article pages.
 */
export async function discoverArticleLinks(baseUrl: string, limit = 30): Promise<string[]> {
  const { html } = await safeFetch(baseUrl);
  const $        = cheerio.load(html);
  const base     = new URL(baseUrl);
  const seen     = new Set<string>();
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, base).href;
      // Only same-domain links, avoid media/home/section pages
      if (
        abs.startsWith(base.origin) &&
        !seen.has(abs) &&
        abs !== base.href &&
        !/\.(jpg|jpeg|png|gif|pdf|mp4|webp)$/i.test(abs) &&
        abs.length < 300
      ) {
        seen.add(abs);
        links.push(abs);
      }
    } catch { /* skip malformed */ }
    if (links.length >= limit) return false;
  });

  return links;
}
