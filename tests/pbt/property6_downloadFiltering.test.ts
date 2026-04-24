import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterDownloadLinks } from '../../src/fileHosts';

/**
 * **Validates: Requirements 3.1, 3.2**
 * Feature: multi-layer-scraping, Property 6: Download Link Filtering Returns All File Host Matches
 *
 * For any list of candidate URLs containing a mix of file host URLs,
 * intermediary URLs, and unrecognized URLs, `filterDownloadLinks(urls)`
 * SHALL return exactly the URLs whose domains match the file host registry,
 * and none of the intermediary or unrecognized URLs.
 */
describe('Feature: multi-layer-scraping, Property 6: Download Link Filtering Returns All File Host Matches', () => {
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

  /** Known intermediary / ad gate domains */
  const INTERMEDIARY_DOMAINS: string[] = [
    'bit.ly', 'adf.ly', 'ouo.io', 'linkvertise.com',
    'shrinkme.io', 'exe.io', 'bc.vc', 'shorturl.at',
    'tinyurl.com', 'cutt.ly', 'shorte.st',
  ];

  /** Domains that are neither file hosts nor intermediaries */
  const UNRECOGNIZED_DOMAINS: string[] = [
    'example.com', 'randomsite.org', 'unknownhost.net',
    'notafilehost.io', 'someblog.co', 'mywebsite.xyz',
  ];

  /** Arbitrary for a URL path segment */
  const pathArb = fc.stringMatching(/^[a-z0-9/_-]{0,30}$/).map((p) => '/' + p);

  /** Arbitrary for the protocol */
  const protocolArb = fc.constantFrom('https://', 'http://');

  /** Arbitrary that generates a file host URL with its expected hostName */
  const fileHostUrlArb = fc.tuple(
    fc.constantFrom(...FILE_HOST_ENTRIES),
    pathArb,
    protocolArb,
  ).map(([[domain, hostName], path, protocol]) => ({
    url: `${protocol}${domain}${path}`,
    hostName,
    category: 'fileHost' as const,
  }));

  /** Arbitrary that generates an intermediary URL */
  const intermediaryUrlArb = fc.tuple(
    fc.constantFrom(...INTERMEDIARY_DOMAINS),
    pathArb,
    protocolArb,
  ).map(([domain, path, protocol]) => ({
    url: `${protocol}${domain}${path}`,
    hostName: '',
    category: 'intermediary' as const,
  }));

  /** Arbitrary that generates an unrecognized URL */
  const unrecognizedUrlArb = fc.tuple(
    fc.constantFrom(...UNRECOGNIZED_DOMAINS),
    pathArb,
    protocolArb,
  ).map(([domain, path, protocol]) => ({
    url: `${protocol}${domain}${path}`,
    hostName: '',
    category: 'unrecognized' as const,
  }));

  /** Arbitrary that generates a mixed list of URLs from all three categories */
  const mixedUrlListArb = fc.tuple(
    fc.array(fileHostUrlArb, { minLength: 0, maxLength: 8 }),
    fc.array(intermediaryUrlArb, { minLength: 0, maxLength: 5 }),
    fc.array(unrecognizedUrlArb, { minLength: 0, maxLength: 5 }),
  ).filter(([fh, int, unrec]) => fh.length + int.length + unrec.length > 0);

  it('should return exactly the file host URLs and exclude intermediary and unrecognized URLs', () => {
    fc.assert(
      fc.property(
        mixedUrlListArb,
        ([fileHostEntries, intermediaryEntries, unrecognizedEntries]) => {
          const allUrls = [
            ...fileHostEntries.map((e) => e.url),
            ...intermediaryEntries.map((e) => e.url),
            ...unrecognizedEntries.map((e) => e.url),
          ];

          // Shuffle to avoid order-dependent behavior
          const shuffled = [...allUrls].sort(() => Math.random() - 0.5);

          const result = filterDownloadLinks(shuffled);
          const resultUrls = result.map((link) => link.url);

          // Count: result should have exactly as many entries as file host URLs
          expect(result).toHaveLength(fileHostEntries.length);

          // All file host URLs should be present in the result
          for (const entry of fileHostEntries) {
            expect(resultUrls).toContain(entry.url);
          }

          // No intermediary URL should appear in the result
          for (const entry of intermediaryEntries) {
            expect(resultUrls).not.toContain(entry.url);
          }

          // No unrecognized URL should appear in the result
          for (const entry of unrecognizedEntries) {
            expect(resultUrls).not.toContain(entry.url);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return correct hostName for each matched file host URL', () => {
    fc.assert(
      fc.property(
        fc.array(fileHostUrlArb, { minLength: 1, maxLength: 10 }),
        (fileHostEntries) => {
          const urls = fileHostEntries.map((e) => e.url);
          const result = filterDownloadLinks(urls);

          // Each result entry should have the correct hostName
          for (const entry of fileHostEntries) {
            const matched = result.find((r) => r.url === entry.url);
            expect(matched).toBeDefined();
            expect(matched!.hostName).toBe(entry.hostName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return an empty array when given only intermediary and unrecognized URLs', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(intermediaryUrlArb, { minLength: 0, maxLength: 5 }),
          fc.array(unrecognizedUrlArb, { minLength: 0, maxLength: 5 }),
        ).filter(([int, unrec]) => int.length + unrec.length > 0),
        ([intermediaryEntries, unrecognizedEntries]) => {
          const allUrls = [
            ...intermediaryEntries.map((e) => e.url),
            ...unrecognizedEntries.map((e) => e.url),
          ];

          const result = filterDownloadLinks(allUrls);
          expect(result).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
