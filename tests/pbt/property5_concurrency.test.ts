import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { GameLink, Source } from '../../src/types';

/**
 * **Validates: Requirements 4.2**
 * Feature: deep-link-scraping, Property 5: Concurrency Limit Enforcement
 *
 * For any list of game links and for any concurrency limit between 1 and the
 * list length, fetchDetailPages(gameLinks, source, concurrencyLimit) SHALL never
 * have more than concurrencyLimit requests in-flight simultaneously.
 */

// Track concurrency metrics
let currentInFlight = 0;
let maxInFlight = 0;

// Mock fetchStatic before importing fetcher so vi.mock hoists correctly
vi.mock('../../src/fetcher', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/fetcher')>();
  return {
    ...original,
    fetchStatic: vi.fn(async (_url: string): Promise<string> => {
      currentInFlight++;
      if (currentInFlight > maxInFlight) {
        maxInFlight = currentInFlight;
      }
      // Small delay to simulate async work and allow concurrency to be observed
      await new Promise((resolve) => setTimeout(resolve, 5));
      currentInFlight--;
      return '<html></html>';
    }),
    fetchWithBrowser: vi.fn(async (_url: string): Promise<string> => {
      currentInFlight++;
      if (currentInFlight > maxInFlight) {
        maxInFlight = currentInFlight;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      currentInFlight--;
      return '<html></html>';
    }),
  };
});

// Import fetchDetailPages after mock is set up
import { fetchDetailPages } from '../../src/fetcher';

describe('Feature: deep-link-scraping, Property 5: Concurrency Limit Enforcement', () => {
  const nonJsSource: Source = {
    url: 'https://example.com',
    name: 'TestSource',
    requiresJs: false,
    deepLink: true,
  };

  beforeEach(() => {
    currentInFlight = 0;
    maxInFlight = 0;
  });

  const gameLinkArb = fc
    .nat({ max: 9999 })
    .map((id): GameLink => ({
      url: `https://example.com/game/${id}`,
      title: `Game ${id}`,
    }));

  it('should never exceed the concurrency limit for in-flight requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(gameLinkArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 20 }),
        async (gameLinks, rawLimit) => {
          const concurrencyLimit = Math.min(rawLimit, gameLinks.length);

          // Reset counters before each run
          currentInFlight = 0;
          maxInFlight = 0;

          const results = await fetchDetailPages(gameLinks, nonJsSource, concurrencyLimit);

          // All results should be returned
          expect(results).toHaveLength(gameLinks.length);

          // The max concurrent requests should never exceed the limit
          expect(maxInFlight).toBeLessThanOrEqual(concurrencyLimit);
        }
      ),
      { numRuns: 100 }
    );
  });
});
