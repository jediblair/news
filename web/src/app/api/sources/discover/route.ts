import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin }              from '@/lib/auth';

const WELL_KNOWN_RSS_PATHS = [
  '/feed', '/feed.xml', '/rss', '/rss.xml', '/rss2.xml',
  '/atom.xml', '/feeds/posts/default', '/blog/feed', '/news/feed',
];

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^fd/,
  /^localhost$/i,
];

function assertSafeUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Only http/https allowed');
  const host = url.hostname.toLowerCase();
  for (const re of PRIVATE_RANGES)
    if (re.test(host)) throw new Error('SSRF blocked: private or loopback address');
}

async function probe(url: string): Promise<{ rssUrl: string; title: string } | null> {
  assertSafeUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NewsAggregatorBot/1.0 (+https://github.com/dwarf/news)' },
    });
  } catch { return null; }
  finally { clearTimeout(timer); }

  if (!res.ok) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) {
    const text = await res.text();
    // Crude title extraction from feed XML
    const titleMatch = text.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
    return { rssUrl: url, title: titleMatch?.[1]?.trim() ?? '' };
  }
  return null;
}

// GET /api/sources/discover?domain=example.com
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const domain = req.nextUrl.searchParams.get('domain')?.trim();
    if (!domain) return NextResponse.json({ error: 'domain param required' }, { status: 400 });

    // Normalise: strip scheme if user pasted it, then add https
    const bare = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const base = `https://${bare}`;
    assertSafeUrl(base); // SSRF guard the base domain itself

    // 1. Try the domain itself (in case it IS already a feed URL)
    const asFeed = await probe(base);
    if (asFeed) return NextResponse.json(asFeed);

    // 2. Try common RSS paths in parallel
    const candidates = WELL_KNOWN_RSS_PATHS.map(p => base + p);
    const results = await Promise.all(candidates.map(probe));
    const first = results.find(Boolean);
    if (first) return NextResponse.json(first);

    // 3. Scrape homepage for <link rel="alternate" type="application/rss+xml">
    const homeController = new AbortController();
    const homeTimer = setTimeout(() => homeController.abort(), 8000);
    let homepageText = '';
    try {
      const homeRes = await fetch(base, {
        signal: homeController.signal,
        headers: { 'User-Agent': 'NewsAggregatorBot/1.0 (+https://github.com/dwarf/news)' },
      });
      if (homeRes.ok) homepageText = await homeRes.text();
    } catch { /* ignore */ }
    finally { clearTimeout(homeTimer); }

    const feedLinkRe = /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*href=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = feedLinkRe.exec(homepageText)) !== null) {
      let href = m[2];
      if (href.startsWith('/')) href = base + href;
      try { assertSafeUrl(href); } catch { continue; }
      const found = await probe(href);
      if (found) return NextResponse.json(found);
    }

    return NextResponse.json({ error: 'No RSS feed found' }, { status: 404 });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden'))
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    if (err instanceof Error && (err.message === 'Invalid URL' || err.message.startsWith('SSRF')))
      return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
