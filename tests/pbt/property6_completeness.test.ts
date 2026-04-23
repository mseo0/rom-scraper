import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Source, GameEntry, FetchResult, GameLink, DetailPageResult, DeepLinkParser } from '../../src/types';

/**
 * **Validates: Requirements 5.3, 6.2**
 * Feature: deep-link-scraping, Property 6: Deep Link Entries Have Complete Fields and Detail Page URL
 *
 * For any GameEntry produced by the deep link pipeline, the entry SHALL have all
 * required fields (index, gameName, downloadUrl, sourceName, sourceUrl) populated
 * with non-empty values, AND the detailPageUrl field SHALL be populated with the
 * URL of the detail page from which the download URL was extracted.
 */

vi.mock('../../src/fetcher');
vi.mock('../../src/parser');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { getDeepLinkParser } from '../../src/parser';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);
const mockedGetDeepLinkParser = vi.mocked(getDeepLinkParser);

describe('Feature: deep-link-scraping, Property 6: Deep Link Entries Have Complete Fields and Detail Page URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Generates a deep-link source descriptor with random game entries.
   */
  const deepLinkSourceArb = fc.record({
    entryCount: fc.integer({ min: 1, max: 8 }),
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
  });

  const sourcesArb = fc.array(deepLinkSourceArb, { minLength: 1, maxLength: 4 });

  it('should produce entries with all required fields populated and detailPageUrl set', async () => {
    await fc.assert(
      fc.asyncProperty(
        sourcesArb,
        async (sourceDescs) => {
          vi.clearAllMocks();

          const allSources: Source[] = [];

          // Build deep-link Source objects
          for (let i = 0; i < sourceDescs.length; i++) {
            const desc = sourceDescs[i];
            const sourceName = `DL_${desc.name}_${i}`;
            const source: Source = {
              url: `https://${sourceName.toLowerCase()}.com`,
              name: sourceName,
              requiresJs: false,
              deepLink: true,
            };

            const gameLinks: GameLink[] = Array.from({ length: desc.entryCount }, (_, j) => ({
              url: `https://${sourceName.toLowerCase()}.com/game/${j}`,
              title: `Game_${sourceName}_${j}`,
            }));

            (source as any)._mockGameLinks = gameLinks;
            allSources.push(source);
          }

          // Mock fetchSource: return HTML for all sources
          mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
            return { source: s, html: '<html>mock</html>', error: null };
          });

          // Mock getDeepLinkParser: return a parser that produces complete entries
          mockedGetDeepLinkParser.mockImplementation((sourceName: string): DeepLinkParser | undefined => {
            const source = allSources.find(s => s.name === sourceName);
            if (!source) return undefined;

            const gameLinks: GameLink[] = (source as any)._mockGameLinks || [];

            return {
              extractGameLinks: (_html: string, _baseUrl: string) => gameLinks,
              extractDownloadEntry: (_html: string, gameLink: GameLink, src: Source): GameEntry | null => {
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

          // Mock fetchDetailPages: return successful results for all game links
          mockedFetchDetailPages.mockImplementation(
            async (gameLinks: GameLink[], _source: Source, _limit: number): Promise<DetailPageResult[]> => {
              return gameLinks.map(gl => ({
                gameLink: gl,
                html: '<html>detail</html>',
                error: null,
              }));
            }
          );

          // Run scrapeAll with deep-link sources only
          const { entries } = await scrapeAll(allSources);

          // Assert every entry has complete fields
          for (const entry of entries) {
            expect(entry.index).toBeGreaterThan(0);
            expect(entry.gameName).toBeTruthy();
            expect(typeof entry.gameName).toBe('string');
            expect(entry.gameName.length).toBeGreaterThan(0);

            expect(entry.downloadUrl).toBeTruthy();
            expect(typeof entry.downloadUrl).toBe('string');
            expect(entry.downloadUrl.length).toBeGreaterThan(0);

            expect(entry.sourceName).toBeTruthy();
            expect(typeof entry.sourceName).toBe('string');
            expect(entry.sourceName.length).toBeGreaterThan(0);

            expect(entry.sourceUrl).toBeTruthy();
            expect(typeof entry.sourceUrl).toBe('string');
            expect(entry.sourceUrl.length).toBeGreaterThan(0);

            // Deep link entries must have detailPageUrl populated
            expect(entry.detailPageUrl).toBeTruthy();
            expect(typeof entry.detailPageUrl).toBe('string');
            expect(entry.detailPageUrl!.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
