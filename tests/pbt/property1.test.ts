import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseArgs } from '../../src/index';

/**
 * **Validates: Requirements 1.1, 1.2**
 * Feature: game-search-command, Property 1: CLI Argument Parsing Correctness
 *
 * For any non-empty string used as a search query, when process.argv contains
 * --search followed by that string, parseArgs SHALL return a CliArgs object with
 * searchQuery equal to that string. Bare arguments (without --search) are also
 * treated as a search query. When no arguments are provided, parseArgs SHALL
 * return searchQuery as null.
 */
describe('Feature: game-search-command, Property 1: CLI Argument Parsing Correctness', () => {
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

  it('should return searchQuery as null when no arguments are provided', () => {
    const result = parseArgs(['node', 'script.js']);
    expect(result).toEqual({ searchQuery: null });
  });

  it('should treat bare arguments as the search query', () => {
    fc.assert(
      fc.property(validQueryString, (query) => {
        const argv = ['node', 'script.js', query];
        const result = parseArgs(argv);
        expect(result.searchQuery).toBe(query.trim());
      }),
      { numRuns: 100 }
    );
  });

  it('should join multiple bare arguments into a single search query', () => {
    const wordArb = fc.stringMatching(/^[a-zA-Z]{1,10}$/);
    fc.assert(
      fc.property(fc.array(wordArb, { minLength: 2, maxLength: 5 }), (words) => {
        const argv = ['node', 'script.js', ...words];
        const result = parseArgs(argv);
        expect(result.searchQuery).toBe(words.join(' '));
      }),
      { numRuns: 100 }
    );
  });
});
