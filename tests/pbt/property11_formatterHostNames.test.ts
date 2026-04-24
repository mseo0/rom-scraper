import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatResults, formatSearchResults } from '../../src/formatter';
import { GameEntry } from '../../src/types';
import { DownloadLink } from '../../src/fileHosts';

/**
 * **Validates: Requirements 7.4**
 * Feature: multi-layer-scraping, Property 11: Formatter Displays Download Links
 *
 * For any GameEntry with a non-empty downloadLinks array, the formatted output
 * string SHALL contain the URL of every DownloadLink in the entry.
 */
describe('Feature: multi-layer-scraping, Property 11: Formatter Displays Download Links', () => {
  const packTypes = ['base', 'update', 'full'];
  const packTypeArb = fc.constantFrom(...packTypes);
  const titleIdArb = fc.stringMatching(/^[A-Z0-9]{16}$/);

  const downloadLinkArb: fc.Arbitrary<DownloadLink> = fc.tuple(titleIdArb, packTypeArb).map(
    ([titleId, packType]) => ({
      url: `https://api.ultranx.ru/games/download/${titleId}/${packType}`,
      hostName: 'notUltraNX',
    })
  );

  const downloadLinksArb = fc.array(downloadLinkArb, { minLength: 1, maxLength: 3 });
  const gameNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,20}$/);
  const sourceNameArb = fc.stringMatching(/^[A-Za-z]{3,10}$/);

  function makeGameEntry(index: number, gameName: string, sourceName: string, downloadLinks: DownloadLink[]): GameEntry {
    return {
      index,
      gameName,
      downloadLinks,
      downloadUrl: downloadLinks[0].url,
      sourceName,
      sourceUrl: `https://${sourceName.toLowerCase()}.com`,
    };
  }

  it('formatResults output contains every download URL', () => {
    fc.assert(
      fc.property(gameNameArb, sourceNameArb, downloadLinksArb, (gameName, sourceName, downloadLinks) => {
        const entry = makeGameEntry(1, gameName, sourceName, downloadLinks);
        const output = formatResults([entry], []);
        for (const link of downloadLinks) {
          expect(output).toContain(link.url);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('formatSearchResults output contains every download URL', () => {
    fc.assert(
      fc.property(gameNameArb, sourceNameArb, downloadLinksArb, (gameName, sourceName, downloadLinks) => {
        const entry = makeGameEntry(1, gameName, sourceName, downloadLinks);
        const output = formatSearchResults([entry], 'test', []);
        for (const link of downloadLinks) {
          expect(output).toContain(link.url);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('formatResults output contains every download URL across multiple entries', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(gameNameArb, sourceNameArb, downloadLinksArb), { minLength: 1, maxLength: 4 }),
        (entryDescs) => {
          const entries = entryDescs.map(([gameName, sourceName, downloadLinks], i) =>
            makeGameEntry(i + 1, gameName, sourceName, downloadLinks),
          );
          const output = formatResults(entries, []);
          for (const entry of entries) {
            for (const link of entry.downloadLinks!) {
              expect(output).toContain(link.url);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
