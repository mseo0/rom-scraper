import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { matchFileHost } from '../../src/fileHosts';

/**
 * **Validates: Requirements 1.3**
 * Feature: multi-layer-scraping, Property 2: Non-Matching URLs Are Rejected
 *
 * For any URL whose hostname does not equal and is not a subdomain of any
 * registered file host domain, and whose path does not end with a known ROM
 * file extension (.nsp, .xci, .nsz), `matchFileHost(url)` SHALL return `null`.
 */
describe('Feature: multi-layer-scraping, Property 2: Non-Matching URLs Are Rejected', () => {
  /** All registered file host domains that must be avoided */
  const REGISTERED_DOMAINS = [
    'mega.nz',
    'mega.io',
    'drive.google.com',
    'mediafire.com',
    '1fichier.com',
    'megaup.net',
    'sendcm.com',
    'doodrive.com',
    'uptobox.com',
    'gofile.io',
    'pixeldrain.com',
    'krakenfiles.com',
    'buzzheavier.com',
  ];

  /** ROM file extensions that also trigger a match */
  const ROM_EXTENSIONS = ['.nsp', '.xci', '.nsz'];

  /**
   * Check if a hostname matches or is a subdomain of any registered domain.
   */
  function matchesRegisteredDomain(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    return REGISTERED_DOMAINS.some(
      (domain) => lower === domain || lower.endsWith('.' + domain)
    );
  }

  /**
   * Check if a path ends with a known ROM file extension.
   */
  function endsWithRomExtension(path: string): boolean {
    const lower = path.toLowerCase();
    return ROM_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  /**
   * Arbitrary for a safe domain label (1-8 lowercase alpha chars).
   * Using only alpha avoids accidentally generating registered domain parts.
   */
  const safeLabelArb = fc.stringMatching(/^[a-z]{1,8}$/);

  /**
   * Arbitrary for a TLD that doesn't collide with registered domains.
   * We pick from TLDs that no registered domain uses.
   */
  const safeTldArb = fc.constantFrom('org', 'dev', 'app', 'xyz', 'info', 'biz', 'us', 'co');

  /**
   * Arbitrary that generates a hostname guaranteed not to match any registered
   * file host domain (neither exact match nor subdomain match).
   */
  const nonMatchingHostnameArb = fc
    .tuple(safeLabelArb, safeTldArb)
    .map(([label, tld]) => `${label}.${tld}`)
    .filter((hostname) => !matchesRegisteredDomain(hostname));

  /**
   * Arbitrary for a URL path that does NOT end with a ROM file extension.
   * Generates safe alphanumeric path segments.
   */
  const safePathArb = fc
    .stringMatching(/^[a-z0-9/_-]{0,30}$/)
    .map((p) => '/' + p)
    .filter((path) => !endsWithRomExtension(path));

  /** Arbitrary for the protocol */
  const protocolArb = fc.constantFrom('https://', 'http://');

  it('should return null for URLs with non-registered domains and non-ROM paths', () => {
    fc.assert(
      fc.property(
        nonMatchingHostnameArb,
        safePathArb,
        protocolArb,
        (hostname, path, protocol) => {
          const url = `${protocol}${hostname}${path}`;
          const result = matchFileHost(url);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null for URLs with subdomains of non-registered domains', () => {
    fc.assert(
      fc.property(
        safeLabelArb,
        nonMatchingHostnameArb,
        safePathArb,
        protocolArb,
        (subdomain, hostname, path, protocol) => {
          const url = `${protocol}${subdomain}.${hostname}${path}`;
          const result = matchFileHost(url);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null for URLs with multi-level subdomains of non-registered domains', () => {
    fc.assert(
      fc.property(
        fc.array(safeLabelArb, { minLength: 2, maxLength: 4 }),
        nonMatchingHostnameArb,
        safePathArb,
        (subdomainParts, hostname, path) => {
          const subdomain = subdomainParts.join('.');
          const url = `https://${subdomain}.${hostname}${path}`;
          const result = matchFileHost(url);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
