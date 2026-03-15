import axios from 'axios';
import { assertSafeUrl, rateLimit } from './security';

const TIMEOUT_MS    = parseInt(process.env.CRAWL_TIMEOUT_MS   ?? '30000', 10);
const MAX_BYTES     = parseInt(process.env.CRAWL_MAX_BYTES     ?? '10485760', 10);
const USER_AGENT    = 'NewsAggregatorBot/1.0 (+http://localhost; respectful-crawler)';

export interface FetchResult {
  url:     string;
  html:    string;
  status:  number;
}

/**
 * Fetch a URL with safety guards:
 *  - SSRF protection via assertSafeUrl
 *  - Rate limiting per domain
 *  - Timeout
 *  - Max response size
 *  - Bot-honest User-Agent
 */
export async function safeFetch(rawUrl: string): Promise<FetchResult> {
  const parsed = assertSafeUrl(rawUrl);
  await rateLimit(parsed.hostname);

  const response = await axios.get(rawUrl, {
    timeout:       TIMEOUT_MS,
    maxContentLength: MAX_BYTES,
    maxBodyLength:    MAX_BYTES,
    responseType:  'text',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    validateStatus: (s) => s < 500,
  });

  return {
    url:    rawUrl,
    html:   response.data as string,
    status: response.status,
  };
}
