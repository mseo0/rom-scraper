import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseArgs } from '../../src/index';

/**
 * **Validates: Requirements 1.1, 1.2**
 * Feature: game-search-command, Property 1: CLI Argument Parsing Correctness
 *
 * For any non-empty string used as a search query, when process.argv contains
 * --search followed by that string, parseArgs SHALL return a CliArgs object with
 * searchQuery equal to that string. When process.argv does not contain --search,
 * parseArgs SHALL return searchQuery as null.
 */
describe('Feature: game-search-command, Property 1: CLI Argument Parsing Correctness', () => {
  /**
   * Generator for non-empty query strings that are valid search inputs.
   * Filters out whitespace-only strings (which trigger process.exit) and
   * the literal "--search" string (edge case).
   */
  const validQueryString = fc
    .string({ minLength: 1 })
    .filter((s) => s.trim().length > 0)
    .filter((s) => s !== '--search');

  it('should return searchQuery equal to the provided query when --search is in argv', () => {
    fc.assert(
      fc.property(validQueryString, (query) => {
        const argv = ['node', 'script.js', '--search', query];
        const result = parseArgs(argv);
        expect(result).toEqual({ searchQuery: query });
      }),
      { numRuns: 100 }
    );
  });

  it('should return searchQuery as null when --search is absent from argv', () => {
    /**
     * Generate random argv arrays that never contain the literal "--search".
     */
    const randomArg = fc
      .string({ minLength: 1 })
      .filter((s) => s !== '--search');

    const randomArgvWithoutSearch = fc
      .array(randomArg, { minLength: 0, maxLength: 10 })
      .map((args) => ['node', 'script.js', ...args]);

    fc.assert(
      fc.property(randomArgvWithoutSearch, (argv) => {
        const result = parseArgs(argv);
        expect(result).toEqual({ searchQuery: null });
      }),
      { numRuns: 100 }
    );
  });
});
