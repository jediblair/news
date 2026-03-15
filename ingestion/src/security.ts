import { URL } from 'url';

// Private/internal IP ranges — block to prevent SSRF
const BLOCKED_PREFIXES = [
  '127.',
  '10.',
  '192.168.',
  '169.254.',
  '::1',
  'localhost',
  '0.0.0.0',
];

function isInternalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_PREFIXES.some(prefix => lower.startsWith(prefix));
}

/**
 * Validates that a URL is safe to fetch (not pointing to internal services).
 * Throws if the URL is blocked.
 */
export function assertSafeUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }

  if (isInternalHost(parsed.hostname)) {
    throw new Error(`Blocked internal host: ${parsed.hostname}`);
  }

  // Block numeric IPs in the 172.16.0.0/12 range
  const ipv4 = parsed.hostname.match(/^(\d+)\.(\d+)\./);
  if (ipv4) {
    const first = parseInt(ipv4[1], 10);
    const second = parseInt(ipv4[2], 10);
    if (first === 172 && second >= 16 && second <= 31) {
      throw new Error(`Blocked docker/private IP: ${parsed.hostname}`);
    }
  }

  return parsed;
}

/** Returns a domain-keyed rate limit store (last request timestamps per domain) */
const lastRequestTime: Map<string, number> = new Map();
const MIN_DELAY_MS = 2000; // minimum 2s between requests to same domain

export async function rateLimit(domain: string): Promise<void> {
  const last = lastRequestTime.get(domain) ?? 0;
  const now  = Date.now();
  const wait  = MIN_DELAY_MS - (now - last);
  if (wait > 0) {
    await new Promise(res => setTimeout(res, wait));
  }
  lastRequestTime.set(domain, Date.now());
}
