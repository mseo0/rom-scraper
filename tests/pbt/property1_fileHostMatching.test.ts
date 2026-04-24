import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { matchFileHost } from '../../src/fileHosts';

/**
 * **Validates: Requirements 1.2, 1.5**
 * Feature: multi-layer-scraping, Property 1: File Host Domain Matching (Including Subdomains)
 *
 * For any URL whose hostname equals a registered file host domain or ends with
 * `.{registeredDomain}` (subdomain match), `matchFileHost(url)` SHALL return a
 * non-null `DownloadLink` with the correct `hostName` and the original URL.
 */
describe('Feature: multi-layer-scraping, Property 1: File Host Domain Matching (Including Subdomains)', () => {
  /** All registered file host domains and their expected display names */
  const FILE_HOST_ENTRIES: [string, string][] = [
    ['mega.nz', 'Mega'],
    ['mega.io', 'Mega'],
    ['drive.google.com', 'Google Drive'],
    ['mediafire.com', 'MediaFire'],
    ['1fichier.com', '1fichier'],
    ['megaup.net', 'MegaUp'],
    ['sendcm.com', 'SendCM'],
    ['doodrive.com', 'DooDrive'],
    ['uptobox.com', 'Uptobox'],
    ['gofile.io', 'Gofile'],
    ['pixeldrain.com', 'Pixeldrain'],
    ['krakenfiles.com', 'KrakenFiles'],
    ['buzzheavier.com', 'Buzzheavier'],
  ];

  /** Arbitrary that picks a registered file host domain and its expected hostName */
  const fileHostEntryArb = fc.constantFrom(...FILE_HOST_ENTRIES);

  /**
   * Arbitrary for a valid subdomain label (1-10 lowercase alphanumeric chars).
   * Avoids empty strings and special characters that would break URL parsing.
   */
  const subdomainLabelArb = fc.stringMatching(/^[a-z0-9]{1,10}$/);

  /** Arbitrary for a URL path segment (alphanumeric, slashes, hyphens) */
  const pathArb = fc.stringMatching(/^[a-z0-9/_-]{0,30}$/).map((p) => '/' + p);

  /** Arbitrary for the protocol */
  const protocolArb = fc.constantFrom('https://', 'http://');

  it('should return a DownloadLink with correct hostName for exact domain matches', () => {
    fc.assert(
      fc.property(
        fileHostEntryArb,
        pathArb,
        protocolArb,
        ([domain, expectedHostName], path, protocol) => {
          const url = `${protocol}${domain}${path}`;
          const result = matchFileHost(url);

          expect(result).not.toBeNull();
          expect(result!.url).toBe(url);
          expect(result!.hostName).toBe(expectedHostName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return a DownloadLink with correct hostName for subdomain matches', () => {
    fc.assert(
      fc.property(
        fileHostEntryArb,
        subdomainLabelArb,
        pathArb,
        protocolArb,
        ([domain, expectedHostName], subdomain, path, protocol) => {
          const url = `${protocol}${subdomain}.${domain}${path}`;
          const result = matchFileHost(url);

          expect(result).not.toBeNull();
          expect(result!.url).toBe(url);
          expect(result!.hostName).toBe(expectedHostName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return a DownloadLink with correct hostName for multi-level subdomain matches', () => {
    fc.assert(
      fc.property(
        fileHostEntryArb,
        fc.array(subdomainLabelArb, { minLength: 2, maxLength: 4 }),
        pathArb,
        ([domain, expectedHostName], subdomainParts, path) => {
          const subdomain = subdomainParts.join('.');
          const url = `https://${subdomain}.${domain}${path}`;
          const result = matchFileHost(url);

          expect(result).not.toBeNull();
          expect(result!.url).toBe(url);
          expect(result!.hostName).toBe(expectedHostName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
