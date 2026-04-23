import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { searchGames } from '../../src/search';
import { GameEntry } from '../../src/types';

/**
 * **Validates: Requirements 3.4**
 * Feature: game-search-command, Property 4: Sequential Re-Indexing
 *
 * For any array of GameEntry objects returned by searchGames, the index field
 * of the entries SHALL form a sequential sequence starting from 1
 * (i.e., the k-th entry has index === k).
 */
describe('Feature: game-search-command, Property 4: Sequential Re-Indexing', () => {
  const gameEntryArb = (substring: string): fc.Arbitrary<GameEntry> =>
    fc.record({
      index: fc.nat(),
      gameName: fc
        .tuple(
          fc.stringMatching(/^[a-zA-Z0-9 ]{0,20}$/),
          fc.stringMatching(/^[a-zA-Z0-9 ]{0,20}$/)
        )
        .map(([prefix, suffix]) => `${prefix}${substring}${suffix}`),
      downloadUrl: fc.stringMatching(/^[a-zA-Z0-9]{1,40}$/).map(
        (s) => `https://example.com/${s}.nsp`
      ),
      sourceName: fc.stringMatching(/^[a-zA-Z0-9]{3,15}$/),
      sourceUrl: fc.constant('https://example.com'),
    });

  const nonMatchingEntryArb: fc.Arbitrary<GameEntry> = fc.record({
    index: fc.nat(),
    gameName: fc.stringMatching(/^[0-9]{1,10}$/),
    downloadUrl: fc.constant('https://example.com/other.nsp'),
    sourceName: fc.stringMatching(/^[a-zA-Z0-9]{3,15}$/),
    sourceUrl: fc.constant('https://example.com'),
  });

  it('should assign sequential index values 1..n to all returned entries', () => {
    const keyword = 'ztestword';

    fc.assert(
      fc.property(
        fc.array(gameEntryArb(keyword), { minLength: 0, maxLength: 10 }),
        fc.array(nonMatchingEntryArb, { minLength: 0, maxLength: 10 }),
        (matchingEntries, nonMatchingEntries) => {
          const allEntries = [...matchingEntries, ...nonMatchingEntries];
          const result = searchGames(keyword, allEntries);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].index).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce sequential indices for any query and any entries', () => {
    const entryArb: fc.Arbitrary<GameEntry> = fc.record({
      index: fc.nat(),
      gameName: fc.string({ minLength: 1 }),
      downloadUrl: fc.string(),
      sourceName: fc.string({ minLength: 1 }),
      sourceUrl: fc.string(),
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(entryArb, { minLength: 0, maxLength: 20 }),
        (query, entries) => {
          const result = searchGames(query, entries);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].index).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
