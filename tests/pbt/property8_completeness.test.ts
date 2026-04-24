import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  Source,
  GameEntry,
  FetchResult,
  ParseResult,
  GameLink,
  DetailPageResult,
  SourceParser,
} from '../../src/types';

/**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 * Feature: multi-layer-scraping, Property 8: GameEntry Completeness for Multi-Layer Pipeline
 *
 * For any GameEntry produced by the multi-layer pipeline, the entry SHALL have:
 * - gameName as a non-empty string
 * - downloadLinks as a non-empty array where each element has non-empty url and hostName
 * - sourceName and sourceUrl as non-empty strings
 * - detailPageUrl as a non-empty string
 */

vi.mock('../../src/fetcher');
vi.mock('../../src/parser');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { parseSource, getDeepLinkParser, getSourceParser } from '../../src/parser';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);
const mockedParseSource = vi.mocked(parseSource);
const mockedGetDeepLinkParser = vi.mocked(getDeepLinkParser);
const mockedGetSourceParser = vi.mocked(getSourceParser);

/** Arbitrary for the number of detail pages per source (at least 1 so we get entries). */
const detailPageCountArb = fc.integer({ min: 1, max: 8 });

/** Arbitrary for the number of multi-layer sources. */
const sourceCountArb = fc.integer({ min: 1, max: 4 });

/** Arbitrary for a non-empty game name string. */
const gameNameArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,30}$/).filter((s) => s.trim().length > 0);

/** File host domains from the registry that matchFileHost will recognize. */
const FILE_HOST_DOMAINS = [
  'mega.nz',
  'mega.io',
  'drive.google.com',
  'mediafire.com',
  '1fichier.com',
  'megaup.net',
  'sendcm.com',
  'doodrive.com',
  'gofile.io',
  'pixeldrain.com',
  'krakenfiles.com',
  'buzzheavier.com',
];

/** Arbitrary that picks a random file host domain. */
const fileHostDomainArb = fc.constantFrom(...FILE_HOST_DOMAINS);

/** Arbitrary for a number of download URLs per detail page (at least 1). */
const downloadCountArb = fc.integer({ min: 1, max: 4 });

/**
 * Generates a descriptor for a multi-layer source with random detail pages,
 * each having random game names and file host URLs.
 */
const multiLayerSourceArb = fc.record({
  sourceName: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
  detailPages: fc.array(
    fc.record({
      gameName: gameNameArb,
      fileHostDomains: fc.array(fileHostDomainArb, { minLength: 1, maxLength: 4 }),
    }),
    { minLength: 1, maxLength: 8 },
  ),
});

describe('Feature: multi-layer-scraping, Property 8: GameEntry Completeness for Multi-Layer Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should produce GameEntry records with all required fields populated for multi-layer sources', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(multiLayerSourceArb, { minLength: 1, maxLength: 4 }),
        async (sourceDescs) => {
          vi.clearAllMocks();

          // Ensure unique source names
          const usedNames = new Set<string>();
          const uniqueDescs = sourceDescs.filter((d) => {
            const key = d.sourceName;
            if (usedNames.has(key)) return false;
            usedNames.add(key);
            return true;
          });
          if (uniqueDescs.length === 0) return;

          const allSources: Source[] = [];
          const multiLayerNames = new Set<string>();

          // Build sources
          let uid = 0;
          for (const desc of uniqueDescs) {
            const name = `ML_${desc.sourceName}_${uid++}`;
            const source: Source = {
              url: `https://${name.toLowerCase()}.example.com`,
              name,
              requiresJs: false,
            };
            allSources.push(source);
            multiLayerNames.add(name);

            // Attach mock data to source
            (source as any)._mockDetailPages = desc.detailPages;
          }

          // --- Mock fetchSource: always succeeds ---
          mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
            return { source: s, html: '<html>catalog</html>', error: null };
          });

          // --- Mock parseSource: returns empty for multi-layer sources ---
          mockedParseSource.mockImplementation((s: Source, _html: string): ParseResult => {
            return { source: s, entries: [], message: null };
          });

          // --- Mock getDeepLinkParser: no deep-link parsers ---
          mockedGetDeepLinkParser.mockReturnValue(undefined);

          // --- Mock getSourceParser: returns a SourceParser for multi-layer sources ---
          mockedGetSourceParser.mockImplementation((sourceName: string): SourceParser | undefined => {
            if (!multiLayerNames.has(sourceName)) return undefined;

            const source = allSources.find((s) => s.name === sourceName);
            if (!source) return undefined;

            const detailPages: Array<{ gameName: string; fileHostDomains: string[] }> =
              (source as any)._mockDetailPages || [];

            // Build game links from detail pages
            const gameLinks: GameLink[] = detailPages.map((dp, i) => ({
              url: `${source.url}/game/${i}`,
              title: dp.gameName,
            }));

            return {
              extractGameLinks: (_html: string, _baseUrl: string) => gameLinks,
              extractDownloadLinks: (_html: string, detailPageUrl: string) => {
                // Find which detail page this is for
                const idx = gameLinks.findIndex((gl) => gl.url === detailPageUrl);
                if (idx < 0) return { gameName: 'Unknown', urls: [] };

                const dp = detailPages[idx];
                // Generate real file host URLs that will pass filterDownloadLinks
                const urls = dp.fileHostDomains.map(
                  (domain, j) => `https://${domain}/file/game_${idx}_${j}`,
                );
                return { gameName: dp.gameName, urls };
              },
            };
          });

          // --- Mock fetchDetailPages: all succeed ---
          mockedFetchDetailPages.mockImplementation(
            async (
              gameLinks: GameLink[],
              _source: Source,
              _limit: number,
            ): Promise<DetailPageResult[]> => {
              return gameLinks.map((gl) => ({
                gameLink: gl,
                html: '<html>detail</html>',
                error: null,
              }));
            },
          );

          // --- Run scrapeAll ---
          const { entries } = await scrapeAll(allSources);

          // --- Calculate expected total entries ---
          const expectedTotal = uniqueDescs.reduce((sum, d) => sum + d.detailPages.length, 0);
          expect(entries).toHaveLength(expectedTotal);

          // --- Verify every entry has all required fields ---
          for (const entry of entries) {
            // gameName must be a non-empty string
            expect(typeof entry.gameName).toBe('string');
            expect(entry.gameName.length).toBeGreaterThan(0);

            // downloadLinks must be a non-empty array
            expect(Array.isArray(entry.downloadLinks)).toBe(true);
            expect(entry.downloadLinks!.length).toBeGreaterThan(0);

            // Each downloadLink must have non-empty url and hostName
            for (const dl of entry.downloadLinks!) {
              expect(typeof dl.url).toBe('string');
              expect(dl.url.length).toBeGreaterThan(0);
              expect(typeof dl.hostName).toBe('string');
              expect(dl.hostName.length).toBeGreaterThan(0);
            }

            // sourceName must be a non-empty string
            expect(typeof entry.sourceName).toBe('string');
            expect(entry.sourceName.length).toBeGreaterThan(0);

            // sourceUrl must be a non-empty string
            expect(typeof entry.sourceUrl).toBe('string');
            expect(entry.sourceUrl.length).toBeGreaterThan(0);

            // detailPageUrl must be a non-empty string
            expect(typeof entry.detailPageUrl).toBe('string');
            expect(entry.detailPageUrl!.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
