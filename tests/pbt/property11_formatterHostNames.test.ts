import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatResults, formatSearchResults } from '../../src/formatter';
import { GameEntry } from '../../src/types';
import { DownloadLink } from '../../src/fileHosts';

/**
 * **Validates: Requirements 7.4**
 * Feature: multi-layer-scraping, Property 11: Formatter Displays Host Names
 *
 * For any GameEntry with a non-empty downloadLinks array, the formatted output
 * string SHALL contain the hostName of every DownloadLink in the entry.
 */
describe('Feature: multi-layer-scraping, Property 11: Formatter Displays Host Names', () => {
  /**
   * Arbitrary for a non-empty host name string (1-20 alphanumeric chars).
   * Avoids characters that could interfere with table rendering.
   */
  const hostNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,14}$/);

  /**
   * Arbitrary for a valid URL string on a generic domain.
   */
  const urlArb = fc
    .tuple(
      fc.constantFrom('https://', 'http://'),
      fc.stringMatching(/^[a-z]{3,10}$/),
      fc.constantFrom('.com', '.net', '.io', '.org'),
      fc.stringMatching(/^\/[a-z0-9]{1,10}$/),
    )
    .map(([proto, domain, tld, path]) => `${proto}${domain}${tld}${path}`);

  /**
   * Arbitrary for a DownloadLink with a random URL and host name.
   */
  const downloadLinkArb: fc.Arbitrary<DownloadLink> = fc.record({
    url: urlArb,
    hostName: hostNameArb,
  });

  /**
   * Arbitrary for a non-empty array of DownloadLinks (1-5 links).
   */
  const downloadLinksArb = fc.array(downloadLinkArb, { minLength: 1, maxLength: 5 });

  /**
   * Arbitrary for a game name (non-empty alphanumeric string).
   */
  const gameNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,20}$/);

  /**
   * Arbitrary for a source name.
   */
  const sourceNameArb = fc.stringMatching(/^[A-Za-z]{3,10}$/);

  /**
   * Build a GameEntry with the given downloadLinks.
   */
  function makeGameEntry(
    index: number,
    gameName: string,
    sourceName: string,
    downloadLinks: DownloadLink[],
  ): GameEntry {
    return {
      index,
      gameName,
      downloadLinks,
      downloadUrl: downloadLinks[0].url,
      sourceName,
      sourceUrl: `https://${sourceName.toLowerCase()}.com`,
    };
  }

  it('formatResults output contains every hostName from downloadLinks', () => {
    fc.assert(
      fc.property(
        gameNameArb,
        sourceNameArb,
        downloadLinksArb,
        (gameName, sourceName, downloadLinks) => {
          const entry = makeGameEntry(1, gameName, sourceName, downloadLinks);
          const output = formatResults([entry], []);

          for (const link of downloadLinks) {
            expect(output).toContain(link.hostName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('formatSearchResults output contains every hostName from downloadLinks', () => {
    fc.assert(
      fc.property(
        gameNameArb,
        sourceNameArb,
        downloadLinksArb,
        (gameName, sourceName, downloadLinks) => {
          const entry = makeGameEntry(1, gameName, sourceName, downloadLinks);
          const output = formatSearchResults([entry], 'test', []);

          for (const link of downloadLinks) {
            expect(output).toContain(link.hostName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('formatResults output contains every hostName when multiple entries have downloadLinks', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(gameNameArb, sourceNameArb, downloadLinksArb),
          { minLength: 1, maxLength: 4 },
        ),
        (entryDescs) => {
          const entries = entryDescs.map(([gameName, sourceName, downloadLinks], i) =>
            makeGameEntry(i + 1, gameName, sourceName, downloadLinks),
          );
          const output = formatResults(entries, []);

          for (const entry of entries) {
            for (const link of entry.downloadLinks!) {
              expect(output).toContain(link.hostName);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
