import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Source, GameEntry, FetchResult, ParseResult, GameLink, DetailPageResult, DeepLinkParser } from '../../src/types';

/**
 * **Validates: Requirements 5.4**
 * Feature: deep-link-scraping, Property 7: Sequential Indexing Across Mixed Sources
 *
 * For any combination of single-pass and deep-link sources producing GameEntry
 * records, the final merged list SHALL have index values forming a contiguous
 * sequence from 1 to N where N is the total number of entries.
 */

vi.mock('../../src/fetcher');
vi.mock('../../src/parser');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { parseSource, getDeepLinkParser } from '../../src/parser';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);
const mockedParseSource = vi.mocked(parseSource);
const mockedGetDeepLinkParser = vi.mocked(getDeepLinkParser);

describe('Feature: deep-link-scraping, Property 7: Sequential Indexing Across Mixed Sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Generates a single-pass source config with a random entry count.
   */
  const singlePassSourceArb = fc.record({
    entryCount: fc.integer({ min: 0, max: 8 }),
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
  });

  /**
   * Generates a deep-link source config with a random entry count.
   */
  const deepLinkSourceArb = fc.record({
    entryCount: fc.integer({ min: 0, max: 8 }),
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
  });

  /**
   * Generates a mixed list of source descriptors (at least 1 source).
   */
  const sourceMixArb = fc.tuple(
    fc.array(singlePassSourceArb, { minLength: 0, maxLength: 4 }),
    fc.array(deepLinkSourceArb, { minLength: 0, maxLength: 4 }),
  ).filter(([sp, dl]) => sp.length + dl.length >= 1);

  it('should assign contiguous indices from 1 to N across all entries from mixed sources', async () => {
    await fc.assert(
      fc.asyncProperty(
        sourceMixArb,
        async ([singlePassDescs, deepLinkDescs]) => {
          vi.clearAllMocks();

          // Build Source objects and set up mocks
          const allSources: Source[] = [];
          let callIndex = 0;

          // --- Single-pass sources ---
          for (const desc of singlePassDescs) {
            const sourceName = `SP_${desc.name}_${callIndex}`;
            const source: Source = {
              url: `https://${sourceName.toLowerCase()}.com`,
              name: sourceName,
              requiresJs: false,
            };
            allSources.push(source);

            const entries: GameEntry[] = Array.from({ length: desc.entryCount }, (_, i) => ({
              index: 0,
              gameName: `Game_${sourceName}_${i}`,
              downloadUrl: `https://${sourceName.toLowerCase()}.com/game${i}.nsp`,
              sourceName: sourceName,
              sourceUrl: source.url,
            }));

            // Capture current callIndex for closure
            const currentIdx = callIndex;
            callIndex++;

            // We'll set up fetchSource and parseSource per-source below
            // Store entries for later mock setup
            (source as any)._mockEntries = entries;
          }

          // --- Deep-link sources ---
          for (const desc of deepLinkDescs) {
            const sourceName = `DL_${desc.name}_${callIndex}`;
            const source: Source = {
              url: `https://${sourceName.toLowerCase()}.com`,
              name: sourceName,
              requiresJs: false,
              deepLink: true,
            };
            allSources.push(source);

            const gameLinks: GameLink[] = Array.from({ length: desc.entryCount }, (_, i) => ({
              url: `https://${sourceName.toLowerCase()}.com/game/${i}`,
              title: `Game_${sourceName}_${i}`,
            }));

            // Store for mock setup
            (source as any)._mockGameLinks = gameLinks;
            (source as any)._mockEntryCount = desc.entryCount;
            callIndex++;
          }

          // Set up fetchSource mock: returns HTML for all sources
          mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
            return { source: s, html: '<html>mock</html>', error: null };
          });

          // Set up parseSource mock: returns entries for single-pass sources
          mockedParseSource.mockImplementation((s: Source, _html: string): ParseResult => {
            const entries = (s as any)._mockEntries || [];
            return { source: s, entries, message: null };
          });

          // Set up getDeepLinkParser mock: returns a parser for deep-link sources
          mockedGetDeepLinkParser.mockImplementation((sourceName: string): DeepLinkParser | undefined => {
            const source = allSources.find(s => s.name === sourceName && s.deepLink);
            if (!source) return undefined;

            const gameLinks: GameLink[] = (source as any)._mockGameLinks || [];
            const entryCount: number = (source as any)._mockEntryCount || 0;

            return {
              extractGameLinks: (_html: string, _baseUrl: string) => gameLinks,
              extractDownloadEntry: (html: string, gameLink: GameLink, src: Source): GameEntry | null => {
                return {
                  index: 0,
                  gameName: gameLink.title,
                  downloadUrl: `${gameLink.url}/download.nsp`,
                  sourceName: src.name,
                  sourceUrl: src.url,
                  detailPageUrl: gameLink.url,
                };
              },
            };
          });

          // Set up fetchDetailPages mock: returns successful results for all game links
          mockedFetchDetailPages.mockImplementation(
            async (gameLinks: GameLink[], _source: Source, _limit: number): Promise<DetailPageResult[]> => {
              return gameLinks.map(gl => ({
                gameLink: gl,
                html: '<html>detail</html>',
                error: null,
              }));
            }
          );

          // Run scrapeAll
          const { entries } = await scrapeAll(allSources);

          // Calculate expected total entries
          const expectedTotal =
            singlePassDescs.reduce((sum, d) => sum + d.entryCount, 0) +
            deepLinkDescs.reduce((sum, d) => sum + d.entryCount, 0);

          // Assert total count matches
          expect(entries).toHaveLength(expectedTotal);

          // Assert indices form a contiguous sequence from 1 to N
          if (expectedTotal > 0) {
            const indices = entries.map(e => e.index);
            for (let i = 0; i < expectedTotal; i++) {
              expect(indices[i]).toBe(i + 1);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
