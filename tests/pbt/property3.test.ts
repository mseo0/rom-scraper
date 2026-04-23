import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatSearchResults, truncate } from '../../src/formatter';
import { GameEntry } from '../../src/types';

/**
 * **Validates: Requirements 3.1, 3.2**
 * Feature: game-search-command, Property 3: Search Output Completeness
 *
 * For any non-empty array of GameEntry objects and for any search query string,
 * the output of formatSearchResults(entries, query, errors) SHALL contain the
 * number of entries, the query string, and for each entry: its gameName (or
 * truncated form), sourceName, and downloadUrl (or truncated form).
 */
describe('Feature: game-search-command, Property 3: Search Output Completeness', () => {
  const gameEntryArb = (index: number) =>
    fc.record({
      index: fc.constant(index),
      gameName: fc.string({ minLength: 1, maxLength: 30 }),
      downloadUrl: fc.string({ minLength: 1, maxLength: 60 }),
      sourceName: fc.string({ minLength: 1, maxLength: 20 }),
      sourceUrl: fc.string({ minLength: 1, maxLength: 30 }),
    });

  const gameEntryArrayArb = fc
    .integer({ min: 1, max: 10 })
    .chain((len) =>
      fc.tuple(
        ...Array.from({ length: len }, (_, i) => gameEntryArb(i + 1))
      )
    ) as fc.Arbitrary<GameEntry[]>;

  const queryArb = fc.string({ minLength: 1, maxLength: 20 });

  it('should contain the entry count, query, and each entry gameName/sourceName/downloadUrl in the output', () => {
    fc.assert(
      fc.property(gameEntryArrayArb, queryArb, (entries, query) => {
        const output = formatSearchResults(entries, query, []);

        // Output should contain the entry count
        expect(output).toContain(String(entries.length));

        // Output should contain the query string
        expect(output).toContain(query);

        // For each entry, output should contain the (possibly truncated) gameName, sourceName, and downloadUrl
        for (const entry of entries) {
          const expectedName = truncate(entry.gameName, 50);
          const expectedUrl = truncate(entry.downloadUrl, 80);

          expect(output).toContain(expectedName);
          expect(output).toContain(entry.sourceName);
          expect(output).toContain(expectedUrl);
        }
      }),
      { numRuns: 100 }
    );
  });
});
