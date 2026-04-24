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
 * **Validates: Requirements 6.5**
 * Feature: multi-layer-scraping, Property 10: Error Aggregation Across Phases
 *
 * For any set of sources where some catalog page fetches fail and some detail
 * page fetches fail, the returned `errors` array SHALL contain an error message
 * for every failed fetch, and the `entries` array SHALL contain results from
 * all successful fetches.
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

/**
 * Describes a multi-layer source with configurable failure modes.
 * - catalogFails: whether the catalog page fetch should fail
 * - detailPages: array of detail pages, each with a flag for whether it fails
 */
interface MultiLayerSourceDesc {
  name: string;
  catalogFails: boolean;
  detailPages: { fails: boolean }[];
}

/**
 * Describes a single-pass source with configurable failure mode.
 * - catalogFails: whether the fetch should fail
 * - entryCount: number of entries to produce on success
 */
interface SinglePassSourceDesc {
  name: string;
  catalogFails: boolean;
  entryCount: number;
}

describe('Feature: multi-layer-scraping, Property 10: Error Aggregation Across Phases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Arbitrary for a multi-layer source descriptor */
  const multiLayerDescArb = fc.record({
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
    catalogFails: fc.boolean(),
    detailPages: fc.array(
      fc.record({ fails: fc.boolean() }),
      { minLength: 0, maxLength: 5 },
    ),
  });

  /** Arbitrary for a single-pass source descriptor */
  const singlePassDescArb = fc.record({
    name: fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/),
    catalogFails: fc.boolean(),
    entryCount: fc.integer({ min: 0, max: 5 }),
  });

  /**
   * Generate a mix of multi-layer and single-pass sources with at least 1 source.
   */
  const sourceMixArb = fc
    .tuple(
      fc.array(multiLayerDescArb, { minLength: 0, maxLength: 3 }),
      fc.array(singlePassDescArb, { minLength: 0, maxLength: 3 }),
    )
    .filter(([ml, sp]) => ml.length + sp.length >= 1);

  it('should aggregate all errors from catalog and detail page failures, and include all successful entries', async () => {
    await fc.assert(
      fc.asyncProperty(sourceMixArb, async ([multiLayerDescs, singlePassDescs]) => {
        vi.clearAllMocks();

        const allSources: Source[] = [];
        let uid = 0;

        // Track expected errors and expected successful entry count
        let expectedErrorCount = 0;
        let expectedEntryCount = 0;

        const multiLayerNames = new Set<string>();

        // --- Build multi-layer sources ---
        const multiLayerConfigs: Map<string, MultiLayerSourceDesc> = new Map();
        for (const desc of multiLayerDescs) {
          const sourceName = `ML_${desc.name}_${uid++}`;
          const source: Source = {
            url: `https://${sourceName.toLowerCase()}.com`,
            name: sourceName,
            requiresJs: false,
          };
          allSources.push(source);
          multiLayerNames.add(sourceName);

          const config: MultiLayerSourceDesc = {
            ...desc,
            name: sourceName,
          };
          multiLayerConfigs.set(sourceName, config);

          if (desc.catalogFails) {
            // Catalog fetch failure = 1 error, no entries from this source
            expectedErrorCount += 1;
          } else {
            // Catalog succeeds — count detail page failures and successes
            for (const dp of desc.detailPages) {
              if (dp.fails) {
                expectedErrorCount += 1;
              } else {
                // Successful detail page produces 1 entry
                expectedEntryCount += 1;
              }
            }
          }
        }

        // --- Build single-pass sources ---
        const singlePassConfigs: Map<string, SinglePassSourceDesc> = new Map();
        for (const desc of singlePassDescs) {
          const sourceName = `SP_${desc.name}_${uid++}`;
          const source: Source = {
            url: `https://${sourceName.toLowerCase()}.com`,
            name: sourceName,
            requiresJs: false,
          };
          allSources.push(source);

          const config: SinglePassSourceDesc = {
            ...desc,
            name: sourceName,
          };
          singlePassConfigs.set(sourceName, config);

          if (desc.catalogFails) {
            expectedErrorCount += 1;
          } else {
            expectedEntryCount += desc.entryCount;
          }
        }

        // --- Mock fetchSource ---
        mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
          const mlConfig = multiLayerConfigs.get(s.name);
          if (mlConfig && mlConfig.catalogFails) {
            return { source: s, html: null, error: `Failed to fetch catalog for ${s.name}` };
          }
          const spConfig = singlePassConfigs.get(s.name);
          if (spConfig && spConfig.catalogFails) {
            return { source: s, html: null, error: `Failed to fetch ${s.name}` };
          }
          return { source: s, html: '<html>mock</html>', error: null };
        });

        // --- Mock getSourceParser ---
        mockedGetSourceParser.mockImplementation((sourceName: string): SourceParser | undefined => {
          if (!multiLayerNames.has(sourceName)) return undefined;

          const config = multiLayerConfigs.get(sourceName);
          if (!config) return undefined;

          const gameLinks: GameLink[] = config.detailPages.map((_, i) => ({
            url: `https://${sourceName.toLowerCase()}.com/game/${i}`,
            title: `Game_${sourceName}_${i}`,
          }));

          return {
            extractGameLinks: (_html: string, _baseUrl: string) => gameLinks,
            extractDownloadLinks: (_html: string, detailPageUrl: string) => ({
              gameName: `Game_from_${detailPageUrl}`,
              urls: [`https://mega.nz/file/${encodeURIComponent(detailPageUrl)}`],
            }),
          };
        });

        // --- Mock getDeepLinkParser: no deep-link sources in this test ---
        mockedGetDeepLinkParser.mockReturnValue(undefined);

        // --- Mock fetchDetailPages ---
        mockedFetchDetailPages.mockImplementation(
          async (
            gameLinks: GameLink[],
            source: Source,
            _limit: number,
          ): Promise<DetailPageResult[]> => {
            const config = multiLayerConfigs.get(source.name);
            if (!config) return [];

            return gameLinks.map((gl, i) => {
              const dpConfig = config.detailPages[i];
              if (dpConfig && dpConfig.fails) {
                return {
                  gameLink: gl,
                  html: null,
                  error: `Failed to fetch detail page ${gl.url}`,
                };
              }
              return {
                gameLink: gl,
                html: '<html>detail</html>',
                error: null,
              };
            });
          },
        );

        // --- Mock parseSource for single-pass sources ---
        mockedParseSource.mockImplementation((s: Source, _html: string): ParseResult => {
          const config = singlePassConfigs.get(s.name);
          if (!config) return { source: s, entries: [], message: null };

          const entries: GameEntry[] = Array.from({ length: config.entryCount }, (_, i) => ({
            index: 0,
            gameName: `Game_${s.name}_${i}`,
            downloadUrl: `https://${s.name.toLowerCase()}.com/game${i}.nsp`,
            sourceName: s.name,
            sourceUrl: s.url,
          }));

          return { source: s, entries, message: null };
        });

        // --- Run scrapeAll ---
        const { entries, errors } = await scrapeAll(allSources);

        // --- Assert error count matches expected ---
        expect(errors).toHaveLength(expectedErrorCount);

        // --- Assert every error is a non-empty string ---
        for (const err of errors) {
          expect(typeof err).toBe('string');
          expect(err.length).toBeGreaterThan(0);
        }

        // --- Assert entry count matches expected ---
        expect(entries).toHaveLength(expectedEntryCount);

        // --- Assert all entries have valid structure ---
        for (const entry of entries) {
          expect(entry.gameName).toBeTruthy();
          expect(entry.sourceName).toBeTruthy();
          expect(entry.sourceUrl).toBeTruthy();
        }
      }),
      { numRuns: 100 },
    );
  });
});
