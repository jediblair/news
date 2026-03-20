import crypto from 'crypto';
import { db }             from './db';
import { parseRssFeed }   from './feeds';
import { scrapeArticle }  from './scraper';
import { fetchFromArchive } from './archive';
import { sanitizeUrl }    from './sanitize';
import { assertSafeUrl }  from './security';

export interface Source {
  id:                  number;
  name:                string;
  domain:              string;
  rss_url:             string | null;
  scrape_selector:     string | null;
  date_selector:       string | null;
  ingestion_method:    string;
  archive_fallback:    boolean;
  max_age_days:        number;
  crawl_interval_mins: number;
}

function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function isTooOld(date: Date | null, maxAgeDays: number): boolean {
  if (!date) return false;
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return date < cutoff;
}

export async function crawlSource(source: Source, jobId: string): Promise<{
  found: number; added: number; updated: number;
}> {
  let found = 0; let added = 0; let updated = 0;

  const log = async (level: string, message: string) => {
    await db.query(
      'INSERT INTO crawl_logs (job_id, level, message) VALUES ($1, $2, $3)',
      [jobId, level, message],
    );
    console.log(`[${level.toUpperCase()}] [${source.name}] ${message}`);
  };

  try {
    let articles: Array<{
      title: string; url: string; summary: string | null;
      content: string | null; imageUrl: string | null;
      author: string | null; publishedDate: Date | null;
    }> = [];

    // ── RSS ingestion ────────────────────────────────────────────────────────
    if (source.ingestion_method === 'rss' && source.rss_url) {
      await log('info', `Parsing RSS feed: ${source.rss_url}`);
      try {
        assertSafeUrl(source.rss_url); // SSRF guard
        articles = await parseRssFeed(source.rss_url);
        await log('info', `Found ${articles.length} items in feed`);
      } catch (err) {
        await log('error', `RSS parse failed: ${(err as Error).message}`);
        if (source.archive_fallback) {
          await log('warn', 'Archive fallback not applicable for RSS — skipping');
        }
      }
    }

    found = articles.length;

    // ── Process each article ─────────────────────────────────────────────────
    for (const art of articles) {
      // Skip articles that are too old
      if (isTooOld(art.publishedDate, source.max_age_days)) continue;

      const safeUrl = sanitizeUrl(art.url);
      if (!safeUrl) {
        await log('warn', `Skipping invalid URL: ${art.url}`);
        continue;
      }

      // SSRF guard on each article URL
      try { assertSafeUrl(safeUrl); } catch (err) {
        await log('warn', `Blocked URL: ${safeUrl} — ${(err as Error).message}`);
        continue;
      }

      const urlHash = hashUrl(safeUrl);

      // Check if already exists
      const existing = await db.query(
        'SELECT id, updated_date FROM articles WHERE url_hash = $1',
        [urlHash],
      );

      if (existing.rows.length > 0) {
        // Only update if source says article changed (updated_date differs)
        // For now, skip to conserve tokens/DB writes
        continue;
      }

      // Scrape the full article page if content is thin or image is missing
      let content = art.content;
      const needsScrape = !content || content.length < 200 || !art.imageUrl;
      if (needsScrape && source.scrape_selector) {
          try {
            const scraped = await scrapeArticle(safeUrl, source.scrape_selector, source.date_selector ?? undefined);
            if (!content || content.length < 200) content = scraped.content ?? content;
            if (!art.publishedDate) art.publishedDate = scraped.publishedDate ?? null;
            if (!art.imageUrl) art.imageUrl = scraped.imageUrl ?? null;
          } catch (err) {
            await log('warn', `Scrape failed for ${safeUrl}: ${(err as Error).message}`);

            // Archive fallback
            if (source.archive_fallback) {
              try {
                const archived = await fetchFromArchive(safeUrl);
                if (archived) {
                  content = archived.slice(0, 50000); // rough cap
                  await log('info', `Used archive fallback for ${safeUrl}`);
                }
              } catch { /* skip */ }
            }
          }
      }

      // Insert article
      await db.query(
        `INSERT INTO articles
          (source_id, title, summary, content, url, url_hash, image_url, author, published_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (url_hash) DO NOTHING`,
        [
          source.id,
          art.title.slice(0, 1000),
          art.summary,
          content,
          safeUrl,
          urlHash,
          sanitizeUrl(art.imageUrl),
          art.author?.slice(0, 255) ?? null,
          art.publishedDate ?? null,
        ],
      );
      added++;
    }

    await log('info', `Done — found: ${found}, added: ${added}, updated: ${updated}`);
  } catch (err) {
    await log('error', `Crawl error: ${(err as Error).message}`);
    throw err;
  }

  return { found, added, updated };
}
