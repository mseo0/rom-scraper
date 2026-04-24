import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  Source,
  GameEntry,
  FetchResult,
  ParseResult,
  GameLink,
  DetailPageResult,
  DeepLinkParser,
  SourceParser,
} from '../../src/types';

/**
 * **Validates: Requirements 6.4**
 * Feature: multi-layer-scraping, Property 9: Sequential Indexing Across All Sources
 *
 * For any combination of single-pass, legacy deep-link, and multi-layer sources
 * producing GameEntry records, the final merged list SHALL have index values
 * forming a contiguous sequence from 1 to N where N is the total number of entries.
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

describe('Feature: multi-layer-scraping, Property 9: Sequential Indexing Across All Sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Generates a source descriptor with a random entry count and a type tag. */
  const singlePassDescArb = fc.record({
    entryCount: fc.integer({ min: 0, max: 6 }),
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
  });

  const deepLinkDescArb = fc.record({
    entryCount: fc.integer({ min: 0, max: 6 }),
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
  });

  const multiLayerDescArb = fc.record({
    entryCount: fc.integer({ min: 0, max: 6 }),
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
  });

  /**
   * Generates a mixed list of source descriptors with at least 1 source total,
   * covering all three pipeline types: single-pass, deep-link, and multi-layer.
   */
  const sourceMixArb = fc
    .tuple(
      fc.array(singlePassDescArb, { minLength: 0, maxLength: 3 }),
      fc.array(deepLinkDescArb, { minLength: 0, maxLength: 3 }),
      fc.array(multiLayerDescArb, { minLength: 0, maxLength: 3 }),
    )
    .filter(([sp, dl, ml]) => sp.length + dl.length + ml.length >= 1);

  it('should assign contiguous indices 1..N across single-pass, deep-link, and multi-layer sources', async () => {
    await fc.assert(
      fc.asyncProperty(sourceMixArb, async ([singlePassDescs, deepLinkDescs, multiLayerDescs]) => {
        vi.clearAllMocks();

        const allSources: Source[] = [];
        let uid = 0;

        // Track which source names are multi-layer vs deep-link
        const multiLayerNames = new Set<string>();
        const deepLinkNames = new Set<string>();

        // --- Build single-pass sources ---
        for (const desc of singlePassDescs) {
          const sourceName = `SP_${desc.name}_${uid++}`;
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
            sourceName,
            sourceUrl: source.url,
          }));

          (source as any)._mockEntries = entries;
        }

        // --- Build deep-link sources ---
        for (const desc of deepLinkDescs) {
          const sourceName = `DL_${desc.name}_${uid++}`;
          const source: Source = {
            url: `https://${sourceName.toLowerCase()}.com`,
            name: sourceName,
            requiresJs: false,
            deepLink: true,
          };
          allSources.push(source);
          deepLinkNames.add(sourceName);

          const gameLinks: GameLink[] = Array.from({ length: desc.entryCount }, (_, i) => ({
            url: `https://${sourceName.toLowerCase()}.com/game/${i}`,
            title: `Game_${sourceName}_${i}`,
          }));

          (source as any)._mockGameLinks = gameLinks;
        }

        // --- Build multi-layer sources ---
        for (const desc of multiLayerDescs) {
          const sourceName = `ML_${desc.name}_${uid++}`;
          const source: Source = {
            url: `https://${sourceName.toLowerCase()}.com`,
            name: sourceName,
            requiresJs: false,
          };
          allSources.push(source);
          multiLayerNames.add(sourceName);

          const gameLinks: GameLink[] = Array.from({ length: desc.entryCount }, (_, i) => ({
            url: `https://${sourceName.toLowerCase()}.com/game/${i}`,
            title: `Game_${sourceName}_${i}`,
          }));

          (source as any)._mockGameLinks = gameLinks;
        }

        // --- Mock fetchSource: always succeeds ---
        mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
          return { source: s, html: '<html>mock</html>', error: null };
        });

        // --- Mock parseSource: returns entries for single-pass sources ---
        mockedParseSource.mockImplementation((s: Source, _html: string): ParseResult => {
          const entries = (s as any)._mockEntries || [];
          return { source: s, entries, message: null };
        });

        // --- Mock getSourceParser: returns a SourceParser for multi-layer sources ---
        mockedGetSourceParser.mockImplementation((sourceName: string): SourceParser | undefined => {
          if (!multiLayerNames.has(sourceName)) return undefined;

          const source = allSources.find((s) => s.name === sourceName);
          if (!source) return undefined;

          const gameLinks: GameLink[] = (source as any)._mockGameLinks || [];

          return {
            extractGameLinks: (_html: string, _baseUrl: string) => gameLinks,
            extractDownloadLinks: (_html: string, detailPageUrl: string) => ({
              gameName: `Game_from_${detailPageUrl}`,
              urls: [`https://mega.nz/file/${encodeURIComponent(detailPageUrl)}`],
            }),
          };
        });

        // --- Mock getDeepLinkParser: returns a DeepLinkParser for deep-link sources ---
        mockedGetDeepLinkParser.mockImplementation(
          (sourceName: string): DeepLinkParser | undefined => {
            if (!deepLinkNames.has(sourceName)) return undefined;

            const source = allSources.find((s) => s.name === sourceName);
            if (!source) return undefined;

            const gameLinks: GameLink[] = (source as any)._mockGameLinks || [];

            return {
              extractGameLinks: (_html: string, _baseUrl: string) => gameLinks,
              extractDownloadEntry: (
                _html: string,
                gameLink: GameLink,
                src: Source,
              ): GameEntry | null => ({
                index: 0,
                gameName: gameLink.title,
                downloadUrl: `${gameLink.url}/download.nsp`,
                sourceName: src.name,
                sourceUrl: src.url,
                detailPageUrl: gameLink.url,
              }),
            };
          },
        );

        // --- Mock fetchDetailPages: returns successful results for all game links ---
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
        const expectedTotal =
          singlePassDescs.reduce((sum, d) => sum + d.entryCount, 0) +
          deepLinkDescs.reduce((sum, d) => sum + d.entryCount, 0) +
          multiLayerDescs.reduce((sum, d) => sum + d.entryCount, 0);

        // --- Assert total count matches ---
        expect(entries).toHaveLength(expectedTotal);

        // --- Assert indices form a contiguous sequence from 1 to N ---
        if (expectedTotal > 0) {
          const indices = entries.map((e) => e.index);
          for (let i = 0; i < expectedTotal; i++) {
            expect(indices[i]).toBe(i + 1);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
