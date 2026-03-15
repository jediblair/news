import RSSParser from 'rss-parser';
import { sanitizeContent, sanitizeUrl, toPlainText } from './sanitize';

const parser = new RSSParser({
  timeout: parseInt(process.env.CRAWL_TIMEOUT_MS ?? '30000', 10),
  headers: {
    'User-Agent': 'NewsAggregatorBot/1.0 (+http://localhost; respectful-crawler)',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

export interface ParsedArticle {
  title:          string;
  url:            string;
  summary:        string | null;
  content:        string | null;
  imageUrl:       string | null;
  author:         string | null;
  publishedDate:  Date | null;
}

export async function parseRssFeed(feedUrl: string): Promise<ParsedArticle[]> {
  const feed = await parser.parseURL(feedUrl);

  return feed.items
    .filter(item => item.link)
    .map(item => {
      const rawContent = (item as unknown as Record<string, string>).contentEncoded ?? item.content ?? item.summary ?? '';
      const rawSummary = item.summary ?? item.contentSnippet ?? '';

      // Extract image URL from media fields or content HTML
      let imageUrl: string | null = null;
      const media = (item as unknown as Record<string, {$?: {url?: string}}>).mediaContent ?? (item as unknown as Record<string, {$?: {url?: string}}>).mediaThumbnail;
      if (media?.$?.url) imageUrl = sanitizeUrl(media.$.url);
      if (!imageUrl) {
        const match = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match) imageUrl = sanitizeUrl(match[1]);
      }

      return {
        title:         item.title?.trim() ?? 'Untitled',
        url:           item.link!,
        summary:       toPlainText(rawSummary).slice(0, 500) || null,
        content:       sanitizeContent(rawContent) || null,
        imageUrl,
        author:        (item as unknown as Record<string, string | undefined>).creator ?? (item as unknown as Record<string, string | undefined>).author ?? null,
        publishedDate: item.pubDate ? new Date(item.pubDate) : null,
      };
    });
}
