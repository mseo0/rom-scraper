import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { GameLink, Source } from '../../src/types';

/**
 * **Validates: Requirements 6.2**
 * Feature: multi-layer-scraping, Property 12: Concurrency Limit Enforcement
 *
 * For any list of game links and for any concurrency limit between 1 and the
 * list length, fetchDetailPages(gameLinks, source, concurrencyLimit) SHALL never
 * have more than concurrencyLimit requests in-flight simultaneously.
 */

// Track concurrency metrics
let currentInFlight = 0;
let maxInFlight = 0;

// Mock axios and stealthwright at the dependency level
vi.mock('axios', () => ({
  default: {
    get: vi.fn(async (_url: string) => {
      currentInFlight++;
      if (currentInFlight > maxInFlight) {
        maxInFlight = currentInFlight;
      }
      // Random small delay to simulate async work and allow concurrency to be observed
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 10) + 1));
      currentInFlight--;
      return { data: '<html>detail page</html>' };
    }),
  },
}));

vi.mock('stealthwright', () => ({
  stealthwright: vi.fn(() => ({
    launch: vi.fn(),
  })),
}));

import { fetchDetailPages } from '../../src/fetcher';

describe('Feature: multi-layer-scraping, Property 12: Concurrency Limit Enforcement', () => {
  const staticSource: Source = {
    url: 'https://example.com',
    name: 'TestMultiLayerSource',
    requiresJs: false,
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

          const results = await fetchDetailPages(gameLinks, staticSource, concurrencyLimit);

          // All results should be returned
          expect(results).toHaveLength(gameLinks.length);

          // The max concurrent requests should never exceed the limit
          expect(maxInFlight).toBeLessThanOrEqual(concurrencyLimit);

          // Each result should correspond to the correct game link
          for (let i = 0; i < gameLinks.length; i++) {
            expect(results[i].gameLink).toEqual(gameLinks[i]);
            expect(results[i].html).toBe('<html>detail page</html>');
            expect(results[i].error).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
