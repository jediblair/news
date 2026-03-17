import { Pool }                      from 'pg';
import axios                          from 'axios';
import { classifyArticle, detectTropes, DEFAULT_TAGS } from './bias';

// ---------------------------------------------------------------------------
// Lightweight article text fetcher for trope detection
// Includes SSRF protection — never fetches private/internal addresses.
// ---------------------------------------------------------------------------
const BLOCKED_HOST_PREFIXES = ['127.', '10.', '192.168.', '169.254.', '::1', 'localhost', '0.0.0.0'];

function isSafeUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    if (BLOCKED_HOST_PREFIXES.some(p => h.startsWith(p))) return false;
    // block 172.16.0.0/12 (docker)
    const m = h.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (m && parseInt(m[1]) === 172 && parseInt(m[2]) >= 16 && parseInt(m[2]) <= 31) return false;
    return true;
  } catch { return false; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Phrases found in block/CAPTCHA/paywall pages rather than real article text
const SOFT_BLOCK_SIGNALS = [
  /enable javascript/i,
  /please (enable|turn on) cookies/i,
  /verify (you are|you'?re) (human|not a robot)/i,
  /access denied/i,
  /subscribe (to|now|for) (access|full|unlimited)/i,
  /this content is (only )?available (to|for) (subscribers?|members?|premium)/i,
  /sign in to (read|continue|access)/i,
  /create (a free )?account to (read|continue|access)/i,
  /403 forbidden/i,
  /429 too many requests/i,
  /cloudflare/i,
  /ddos protection/i,
  /checking your browser/i,
  /just a moment/i,  // Cloudflare interstitial title
];

export type FetchOutcome = 'ok' | 'blocked' | 'ratelimited' | 'paywall' | 'soft-block' | 'error' | 'skipped';

export interface ArticleFetchResult {
  text:       string;
  outcome:    FetchOutcome;
  httpStatus?: number;
}

/**
 * Pure function: given an HTTP status and stripped text, determine the fetch outcome.
 * Extracted separately so it can be unit-tested without making network requests.
 */
export function determineOutcome(httpStatus: number, text: string): FetchOutcome {
  if (httpStatus === 429) return 'ratelimited';
  if (httpStatus === 403 || httpStatus === 401) return 'blocked';
  if (httpStatus === 402 || httpStatus === 451) return 'paywall';
  if (httpStatus >= 400) return 'error';
  if (text.length < 150) return 'soft-block';
  for (const signal of SOFT_BLOCK_SIGNALS) {
    if (signal.test(text)) return 'soft-block';
  }
  if (!hasArticleQuality(text)) return 'soft-block';
  return 'ok';
}

/**
 * Heuristic check that the text looks like real article prose rather than
 * navigation menus, error pages, or other boilerplate.
 *
 * Checks:
 * 1. Unique word ratio — boilerplate is repetitive; real prose has variety.
 * 2. Average word length — nav menus tend to be short words/phrases.
 * 3. Sentence count — real articles have multiple sentences.
 */
export function hasArticleQuality(text: string): boolean {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  if (words.length < 40) return false;  // fewer than ~40 words is too thin

  // 1. Unique word ratio: real prose > ~30% unique words; nav spam is much lower
  const uniqueRatio = new Set(words).size / words.length;
  if (uniqueRatio < 0.30) return false;

  // 2. Average word length: real prose averages 4-5+ chars; short nav words average lower
  const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
  if (avgLen < 3.5) return false;

  // 3. At least 3 sentence-ending punctuation marks
  const sentences = (text.match(/[.!?]+/g) ?? []).length;
  if (sentences < 3) return false;

  return true;
}

export async function fetchArticleText(url: string): Promise<ArticleFetchResult> {
  if (!isSafeUrl(url)) return { text: '', outcome: 'skipped' };

  let httpStatus: number | undefined;
  try {
    const resp = await axios.get<string>(url, {
      timeout: 15000,
      maxContentLength: 2 * 1024 * 1024,
      responseType: 'text',
      headers: {
        'User-Agent': 'NewsAggregatorBot/1.0 (+http://localhost; respectful-crawler)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      // Don't auto-throw on 4xx — we inspect them ourselves
      validateStatus: () => true,
    });

    httpStatus = resp.status;
    const text = httpStatus < 400 ? stripHtml(resp.data).slice(0, 8000) : '';
    const outcome = determineOutcome(httpStatus, text);
    return { text: outcome === 'ok' ? text : '', outcome, httpStatus };
  } catch (err: unknown) {
    return { text: '', outcome: 'error', httpStatus };
  }
}

// Test-only exports (tree-shaken in production build)
export { isSafeUrl as _isSafeUrl, stripHtml as _stripHtml, fetchArticleText as _fetchArticleText };

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

const BATCH_SIZE     = 50;
const CONCURRENCY    = 5;      // parallel Ollama requests per batch
const INTERVAL_MS    = 5_000;  // run every 5 seconds

/** Load classifier tags from app_settings, falling back to built-in defaults. */
async function loadClassifierTags(): Promise<string[]> {
  try {
    const { rows } = await db.query<{ value: string[] }>(
      `SELECT value FROM app_settings WHERE key = 'classifier_tags'`,
    );
    if (rows.length > 0 && Array.isArray(rows[0].value) && rows[0].value.length > 0) {
      return rows[0].value as string[];
    }
  } catch (err) {
    console.warn('[classifier] Could not load tags from DB, using defaults:', (err as Error).message);
  }
  return DEFAULT_TAGS;
}

/**
 * Find unclassified articles and classify them in small batches.
 */
async function classifyBatch(): Promise<void> {
  const validTags = await loadClassifierTags();

  const { rows } = await db.query<{
    id: string; title: string; summary: string | null; content: string | null; url: string;
  }>(
    `SELECT id, title, summary, content, url FROM articles
     WHERE classified = FALSE
       AND (summary IS NOT NULL OR title IS NOT NULL)
     LIMIT $1`,
    [BATCH_SIZE],
  );

  if (rows.length === 0) return;
  console.log(`[classifier] Classifying ${rows.length} articles (concurrency ${CONCURRENCY}, tags: ${validTags.length})...`);

  // Process in parallel with a concurrency cap
  const queue = [...rows];
  async function worker() {
    while (queue.length > 0) {
      const article = queue.shift()!;
      try {
        const bodyText = (article.content && article.content.length > (article.summary?.length ?? 0))
          ? article.content.slice(0, 4000)
          : (article.summary ?? article.title);

        // For trope detection, prefer full article text fetched from the URL
        // when what we have stored is too thin to be meaningful (< 500 chars).
        let tropeText = `${article.title} ${bodyText}`;
        let fetchedContent: string | null = null;
        if (bodyText.length < 500) {
          const fetched = await fetchArticleText(article.url);
          if (fetched.outcome === 'ok') {
            tropeText = fetched.text;
            fetchedContent = fetched.text;
            console.log(`[classifier] Fetched full text (${fetched.text.length} chars): ${article.url}`);
          } else {
            console.warn(`[classifier] Fetch ${fetched.outcome}${fetched.httpStatus ? ` HTTP ${fetched.httpStatus}` : ''}: ${article.url}`);
          }
        }

        // When we fetched a full article, use it for the LLM bias/tag call too,
        // not just for trope detection.
        const llmText = fetchedContent ? fetchedContent.slice(0, 4000) : bodyText;
        const { bias, tags, trope_score } = await classifyArticle(article.title, llmText, validTags, tropeText);

        await db.query(
          `UPDATE articles
           SET bias_tag = $2, classified = TRUE, content_tags = $3, trope_score = $4
             ${fetchedContent !== null ? ', content = $5' : ''}
           WHERE id = $1`,
          fetchedContent !== null
            ? [article.id, bias, tags, trope_score, fetchedContent]
            : [article.id, bias, tags, trope_score],
        );
      } catch (err) {
        console.error(`[classifier] Failed on article ${article.id}:`, err);
        await db.query(
          `UPDATE articles SET bias_tag = 'unknown', classified = TRUE WHERE id = $1`,
          [article.id],
        );
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
}

async function main(): Promise<void> {
  console.log('[classifier] Starting classification worker...');

  // Wait for DB
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await db.query('SELECT 1');
      console.log('[classifier] Database connected');
      break;
    } catch {
      console.warn(`[classifier] DB not ready (${attempt}/10), retrying...`);
      await new Promise(r => setTimeout(r, 3000));
      if (attempt === 10) { console.error('[classifier] Cannot connect to DB'); process.exit(1); }
    }
  }

  // Run on interval
  const run = async () => {
    try { await classifyBatch(); } catch (err) { console.error('[classifier] Batch error:', err); }
    setTimeout(run, INTERVAL_MS);
  };

  setTimeout(run, 10_000); // initial delay to let ingestion populate some articles
}

// Only start the worker when run directly, not when require()'d by tests
if (require.main === module) {
  main().catch(err => { console.error('[classifier] Fatal:', err); process.exit(1); });
}
