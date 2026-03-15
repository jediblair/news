import { safeFetch } from './fetcher';

const ARCHIVE_HOSTS = [
  'https://archive.ph',
  'https://archive.org/wayback/available?url=',
];

/**
 * Attempts to fetch a cached version of a URL from archive.ph (archive.is).
 * Returns the archived HTML, or null if not available.
 */
export async function fetchFromArchive(url: string): Promise<string | null> {
  // Try archive.ph first
  try {
    const archiveUrl = `https://archive.ph/newest/${encodeURIComponent(url)}`;
    const result     = await safeFetch(archiveUrl);
    if (result.status === 200 && result.html.length > 500) {
      return result.html;
    }
  } catch {
    // Fall through to Wayback Machine
  }

  // Try Wayback Machine availability API
  try {
    const availUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const result   = await safeFetch(availUrl);
    const data     = JSON.parse(result.html) as { archived_snapshots?: { closest?: { url?: string; available?: boolean } } };
    const closest  = data?.archived_snapshots?.closest;
    if (closest?.available && closest?.url) {
      const snapResult = await safeFetch(closest.url);
      if (snapResult.status === 200) return snapResult.html;
    }
  } catch {
    // Not available
  }

  return null;
}
