import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'figcaption',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'title'],
};

/**
 * Strips all dangerous HTML from article content.
 * Removes scripts, iframes, event handlers, external resources, etc.
 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
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
