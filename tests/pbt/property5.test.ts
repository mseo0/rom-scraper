import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { searchGames } from '../../src/search';
import { GameEntry } from '../../src/types';

/**
 * **Validates: Requirements 4.1**
 * Feature: game-search-command, Property 5: Whitespace Trimming Equivalence
 *
 * For any search query string and for any amount of leading/trailing whitespace
 * added to that query, searchGames(paddedQuery, entries) SHALL return the same
 * set of entries as searchGames(trimmedQuery, entries).
 */
describe('Feature: game-search-command, Property 5: Whitespace Trimming Equivalence', () => {
  const gameEntryArb = fc.record({
    index: fc.nat(),
    gameName: fc.string({ minLength: 1 }),
    downloadUrl: fc.string(),
    sourceName: fc.string({ minLength: 1 }),
    sourceUrl: fc.string(),
  });

  const gameEntryArrayArb = fc.array(gameEntryArb, { minLength: 0, maxLength: 20 });

  // Generate a non-empty, non-whitespace-only query
  const baseQueryArb = fc
    .string({ minLength: 1 })
    .filter((s) => s.trim().length > 0);

  // Generate whitespace padding using spaces and tabs
  const whitespaceArb = fc
    .array(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 10 })
    .map((chars) => chars.join(''));

  it('should return the same results for a padded query as for the trimmed query', () => {
    fc.assert(
      fc.property(
        baseQueryArb,
        whitespaceArb,
        whitespaceArb,
        gameEntryArrayArb,
        (baseQuery, leadingWs, trailingWs, entries) => {
          const trimmedQuery = baseQuery.trim();
          const paddedQuery = leadingWs + baseQuery + trailingWs;

          const trimmedResult = searchGames(trimmedQuery, entries);
          const paddedResult = searchGames(paddedQuery, entries);

          expect(paddedResult.length).toBe(trimmedResult.length);
          expect(paddedResult.map((e) => e.gameName)).toEqual(
            trimmedResult.map((e) => e.gameName)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
