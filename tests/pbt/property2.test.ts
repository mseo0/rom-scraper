import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { searchGames } from '../../src/search';
import { GameEntry } from '../../src/types';

/**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * Feature: game-search-command, Property 2: Case-Insensitive Substring Filter Correctness
 *
 * For any search query string and for any array of GameEntry objects,
 * searchGames(query, entries) SHALL return exactly those entries where
 * entry.gameName.toLowerCase() contains query.trim().toLowerCase() as a substring,
 * and SHALL exclude all others.
 */
describe('Feature: game-search-command, Property 2: Case-Insensitive Substring Filter Correctness', () => {
  const gameEntryArb = fc.record({
    index: fc.nat(),
    gameName: fc.string({ minLength: 1 }),
    downloadUrl: fc.string(),
    sourceName: fc.string({ minLength: 1 }),
    sourceUrl: fc.string(),
  });

  const gameEntryArrayArb = fc.array(gameEntryArb, { minLength: 0, maxLength: 20 });

  const queryArb = fc.string({ minLength: 1 });

  it('should return exactly those entries where gameName contains the query as a case-insensitive substring', () => {
    fc.assert(
      fc.property(queryArb, gameEntryArrayArb, (query, entries) => {
        const trimmedLowerQuery = query.trim().toLowerCase();

        const expected = entries.filter((e) =>
          e.gameName.toLowerCase().includes(trimmedLowerQuery)
        );

        const actual = searchGames(query, entries);

        expect(actual.length).toBe(expected.length);
        expect(actual.map((e) => e.gameName)).toEqual(expected.map((e) => e.gameName));
      }),
      { numRuns: 100 }
    );
  });
});
