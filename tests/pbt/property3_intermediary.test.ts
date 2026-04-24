import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isIntermediary, filterDownloadLinks } from '../../src/fileHosts';

/**
 * **Validates: Requirements 4.2**
 * Feature: multi-layer-scraping, Property 3: Intermediary URLs Are Excluded
 *
 * For any URL whose hostname matches a known intermediary domain,
 * `isIntermediary(url)` SHALL return `true`, and `filterDownloadLinks`
 * SHALL exclude that URL from its output.
 */
describe('Feature: multi-layer-scraping, Property 3: Intermediary URLs Are Excluded', () => {
  /** All known intermediary domains */
  const INTERMEDIARY_DOMAINS: string[] = [
    'bit.ly', 'adf.ly', 'ouo.io', 'linkvertise.com',
    'shrinkme.io', 'exe.io', 'bc.vc', 'shorturl.at',
    'tinyurl.com', 'cutt.ly', 'shorte.st',
  ];

  /** Known file host domains for generating mixed URL lists */
  const FILE_HOST_DOMAINS: [string, string][] = [
    ['mega.nz', 'Mega'],
    ['mediafire.com', 'MediaFire'],
    ['1fichier.com', '1fichier'],
    ['gofile.io', 'Gofile'],
  ];

  /** Arbitrary that picks a known intermediary domain */
  const intermediaryDomainArb = fc.constantFrom(...INTERMEDIARY_DOMAINS);

  /** Arbitrary for a valid subdomain label (1-10 lowercase alphanumeric chars) */
  const subdomainLabelArb = fc.stringMatching(/^[a-z0-9]{1,10}$/);

  /** Arbitrary for a URL path segment */
  const pathArb = fc.stringMatching(/^[a-z0-9/_-]{0,30}$/).map((p) => '/' + p);

  /** Arbitrary for the protocol */
  const protocolArb = fc.constantFrom('https://', 'http://');

  it('should return true from isIntermediary for exact intermediary domain matches', () => {
    fc.assert(
      fc.property(
        intermediaryDomainArb,
        pathArb,
        protocolArb,
        (domain, path, protocol) => {
          const url = `${protocol}${domain}${path}`;
          expect(isIntermediary(url)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return true from isIntermediary for subdomain matches of intermediary domains', () => {
    fc.assert(
      fc.property(
        intermediaryDomainArb,
        subdomainLabelArb,
        pathArb,
        protocolArb,
        (domain, subdomain, path, protocol) => {
          const url = `${protocol}${subdomain}.${domain}${path}`;
          expect(isIntermediary(url)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should exclude intermediary URLs from filterDownloadLinks output', () => {
    fc.assert(
      fc.property(
        intermediaryDomainArb,
        pathArb,
        protocolArb,
        (domain, path, protocol) => {
          const intermediaryUrl = `${protocol}${domain}${path}`;
          const result = filterDownloadLinks([intermediaryUrl]);

          expect(result).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should exclude intermediary URLs even when mixed with valid file host URLs', () => {
    /** Arbitrary that picks a file host domain entry */
    const fileHostEntryArb = fc.constantFrom(...FILE_HOST_DOMAINS);

    fc.assert(
      fc.property(
        fc.array(intermediaryDomainArb, { minLength: 1, maxLength: 5 }),
        fc.array(fileHostEntryArb, { minLength: 1, maxLength: 5 }),
        pathArb,
        protocolArb,
        (intermediaryDomains, fileHostEntries, path, protocol) => {
          const intermediaryUrls = intermediaryDomains.map(
            (d) => `${protocol}${d}${path}`
          );
          const fileHostUrls = fileHostEntries.map(
            ([d]) => `${protocol}${d}${path}`
          );

          // Mix intermediary and file host URLs together
          const allUrls = [...intermediaryUrls, ...fileHostUrls];
          const result = filterDownloadLinks(allUrls);

          // No intermediary URL should appear in the result
          const resultUrls = result.map((link) => link.url);
          for (const intUrl of intermediaryUrls) {
            expect(resultUrls).not.toContain(intUrl);
          }

          // All file host URLs should be present in the result
          for (const fhUrl of fileHostUrls) {
            expect(resultUrls).toContain(fhUrl);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
