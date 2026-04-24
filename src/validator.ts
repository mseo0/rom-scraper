import axios from 'axios';
import { DownloadLink } from './fileHosts';

/** Phrases in response body that indicate a soft 404 (case-insensitive) */
export const SOFT_404_PHRASES: string[] = [
  'file does not exist',
  'file has been removed',
  'has been deleted',
];

/** Default timeout per HTTP request in milliseconds */
export const VALIDATION_TIMEOUT = 5000;

/** Default maximum concurrent validation requests */
export const DEFAULT_CONCURRENCY = 5;

/** HTTP status codes that indicate a live link (301/302/303) or need body check (200) */
const LIVE_STATUSES = new Set([200, 301, 302, 303]);

/** HTTP status codes that indicate HEAD is not supported (retry with GET) */
const HEAD_NOT_SUPPORTED = new Set([405, 501]);

/** HTTP status codes that definitively indicate a dead link */
const DEAD_STATUSES = new Set([404, 410]);

export interface ValidationResult {
  link: DownloadLink;
  alive: boolean;
}

/**
 * Classify an HTTP status code from a HEAD request.
 *
 * - 200 → 'check-body' (need GET to inspect for soft 404)
 * - 301, 302, 303 → 'alive' (redirect to file)
 * - 404, 410 → 'dead'
 * - 405, 501 → 'head-not-supported' (retry with GET)
 * - All others → 'dead'
 */
export function classifyHeadStatus(
  status: number
): 'alive' | 'dead' | 'head-not-supported' | 'check-body' {
  if (status === 200) return 'check-body';
  if (status === 301 || status === 302 || status === 303) return 'alive';
  if (DEAD_STATUSES.has(status)) return 'dead';
  if (HEAD_NOT_SUPPORTED.has(status)) return 'head-not-supported';
  return 'dead';
}

/**
 * Check if a response body contains any soft 404 phrase.
 * Uses case-insensitive substring matching against SOFT_404_PHRASES.
 * Returns true if the body indicates the file does not exist.
 */
export function isSoft404(body: string): boolean {
  const lower = body.toLowerCase();
  return SOFT_404_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * Classify a single download link as alive or dead.
 *
 * Strategy:
 * 1. Send HTTP HEAD request with timeout
 * 2. If 404/410 → dead
 * 3. If 405/501 → retry with GET, classify by GET response status
 * 4. If 200 → send GET to check for soft 404 phrases in body
 * 5. If 301/302/303 → alive (redirect to file)
 * 6. Network error or timeout → dead
 */
export async function validateLink(link: DownloadLink): Promise<ValidationResult> {
  try {
    const headResponse = await axios.head(link.url, {
      timeout: VALIDATION_TIMEOUT,
      validateStatus: () => true,
      maxRedirects: 0,
    });

    const classification = classifyHeadStatus(headResponse.status);

    switch (classification) {
      case 'dead':
        return { link, alive: false };

      case 'alive':
        return { link, alive: true };

      case 'head-not-supported': {
        // Retry with GET to determine liveness
        const getResponse = await axios.get(link.url, {
          timeout: VALIDATION_TIMEOUT,
          validateStatus: () => true,
        });
        const getClassification = classifyHeadStatus(getResponse.status);
        // For GET fallback, treat 'check-body' (200) as alive since we got a response
        // and 'head-not-supported' shouldn't happen on GET, but treat as dead if it does
        if (getClassification === 'alive' || getClassification === 'check-body') {
          // If status is 200, also check for soft 404
          if (getResponse.status === 200) {
            const body = typeof getResponse.data === 'string'
              ? getResponse.data
              : String(getResponse.data);
            return { link, alive: !isSoft404(body) };
          }
          return { link, alive: true };
        }
        return { link, alive: false };
      }

      case 'check-body': {
        // Status 200 — need to GET the body and check for soft 404
        const getResponse = await axios.get<string>(link.url, {
          timeout: VALIDATION_TIMEOUT,
          validateStatus: () => true,
        });
        const body = typeof getResponse.data === 'string'
          ? getResponse.data
          : String(getResponse.data);
        return { link, alive: !isSoft404(body) };
      }
    }
  } catch {
    // Network error, timeout, or any other failure → dead
    return { link, alive: false };
  }
}

/**
 * Validate multiple download links concurrently.
 * Returns only the links classified as alive, preserving their original order.
 *
 * Uses a worker pool pattern with the given concurrency limit.
 */
export async function validateLinks(
  links: DownloadLink[],
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<DownloadLink[]> {
  if (links.length === 0) return [];

  const results: ValidationResult[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < links.length) {
      const currentIndex = index++;
      results[currentIndex] = await validateLink(links[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, links.length) },
    () => next()
  );
  await Promise.all(workers);

  return results.filter((r) => r.alive).map((r) => r.link);
}
