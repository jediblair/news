import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'figcaption',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'title'],
};

// Elements to remove before extracting content
const JUNK_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  '[class*="share"]', '[class*="social"]', '[class*="related"]',
  '[class*="sidebar"]', '[class*="comment"]', '[class*="newsletter"]',
  '[class*="promo"]', '[class*="advert"]', '[class*="signup"]',
  '[class*="nav-"]', '[class*="site-header"]', '[class*="site-footer"]',
  '[class*="submenu"]', '[class*="breadcrumb"]', '[class*="toolbar"]',
  '[id*="share"]', '[id*="social"]', '[id*="related"]',
  '[id*="sidebar"]', '[id*="comment"]', '[id*="newsletter"]',
  '.ad', '.ads', '.advertisement',
].join(', ');

// Patterns that indicate a "continue reading" / "read more" link
const CONTINUE_READING_RE = /continue\s+reading|read\s+more|read\s+full|view\s+full/i;

/**
 * Strip non-content elements (nav, headers, footers, social, ads, "continue reading")
 * from raw HTML before sanitisation.
 */
export function cleanArticleHtml(html: string): string {
  const $ = cheerio.load(html, { xmlMode: false });

  // Remove structural / advert junk
  $(JUNK_SELECTORS).remove();

  // Remove "continue reading" / "read more" links
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    if (CONTINUE_READING_RE.test(text)) $(el).remove();
  });

  return $.html();
}

/**
 * Strips all dangerous HTML from article content.
 * Removes scripts, iframes, event handlers, external resources, etc.
 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(cleanArticleHtml(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['https', 'http'],
    // Strip all attributes not explicitly allowed
    disallowedTagsMode: 'discard',
    // Reject style/class attrs unless explicitly allowed above
    allowedClasses: {},
  });
}

/**
 * Strip all HTML and return plain text.
 */
export function toPlainText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\s+/g, ' ').trim();
}

/**
 * Sanitize a URL for storage — must be http/https.
 */
export function sanitizeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}
