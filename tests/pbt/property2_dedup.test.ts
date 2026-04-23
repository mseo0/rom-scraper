import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { nspGameHubParser } from '../../src/parsers/nspGameHub';

/**
 * **Validates: Requirements 1.4**
 * Feature: deep-link-scraping, Property 2: Game Link Deduplication
 *
 * For any HTML string containing duplicate anchor elements pointing to the same
 * detail page URL, extractGameLinks(html, baseUrl) SHALL return a list where
 * every URL is unique — i.e., the length of the result equals the number of
 * distinct matching URLs in the input.
 */

/**
 * Arbitrary: generates a simple domain name like "example" or "mysite".
 */
const domainNameArb = fc.stringMatching(/^[a-z]{3,10}$/);

/**
 * Arbitrary: generates a relative path segment like /games/abc123
 */
const relativePathArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,8}$/),
    fc.stringMatching(/^[a-z0-9]{1,8}$/),
  )
  .map(([seg1, seg2]) => `/${seg1}/${seg2}`);

/**
 * Builds HTML with duplicate anchor elements. Each unique path is repeated
 * a random number of times (at least 2) to ensure duplicates exist.
 */
function buildHtmlWithDuplicates(
  baseDomain: string,
  paths: string[],
  repeatCounts: number[],
): string {
  const anchors: string[] = [];
  for (let i = 0; i < paths.length; i++) {
    const href = `https://${baseDomain}.com${paths[i]}`;
    const count = repeatCounts[i];
    for (let j = 0; j < count; j++) {
      anchors.push(`<a href="${href}">Game ${i} copy ${j}</a>`);
    }
  }
  return `<html><body>${anchors.join('\n')}</body></html>`;
}

describe('Feature: deep-link-scraping, Property 2: Game Link Deduplication', () => {
  it('should return unique URLs when HTML contains duplicate links', () => {
    fc.assert(
      fc.property(
        domainNameArb.chain((baseDomain) =>
          fc
            .tuple(
              // Generate 1-15 unique paths
              fc.uniqueArray(relativePathArb, { minLength: 1, maxLength: 15 }),
            )
            .chain(([paths]) =>
              // For each path, generate a repeat count (2-5 to guarantee duplicates)
              fc
                .array(fc.integer({ min: 2, max: 5 }), {
                  minLength: paths.length,
                  maxLength: paths.length,
                })
                .map((repeatCounts) => ({
                  baseDomain,
                  baseUrl: `https://${baseDomain}.com`,
                  paths,
                  repeatCounts,
                })),
            ),
        ),
        ({ baseDomain, baseUrl, paths, repeatCounts }) => {
          const html = buildHtmlWithDuplicates(baseDomain, paths, repeatCounts);
          const result = nspGameHubParser.extractGameLinks(html, baseUrl);

          // Every URL in the result must be unique
          const urls = result.map((link) => link.url);
          const uniqueUrls = new Set(urls);
          expect(urls.length).toBe(uniqueUrls.size);

          // The length of the result equals the number of distinct matching URLs in the input
          const expectedDistinctCount = paths.length;
          expect(result.length).toBe(expectedDistinctCount);

          // All URLs are still absolute and same-domain
          for (const gameLink of result) {
            expect(
              gameLink.url.startsWith('https://'),
              `Expected absolute URL but got: ${gameLink.url}`,
            ).toBe(true);

            const linkDomain = new URL(gameLink.url).hostname;
            expect(linkDomain).toBe(`${baseDomain}.com`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
