import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { notUltraNXParser } from '../../src/parsers/notUltraNX';

/**
 * **Validates: Requirements 2.3**
 * Feature: multi-layer-scraping, Property 5: Game Link Deduplication
 *
 * For any HTML string containing duplicate anchor elements pointing to the same
 * detail page URL, extractGameLinks(html, baseUrl) SHALL return a list where
 * every URL is unique — the length of the result equals the number of distinct
 * matching URLs in the input.
 */
describe('Feature: multi-layer-scraping, Property 5: Game Link Deduplication', () => {
  /** Arbitrary for a path segment */
  const pathSegmentArb = fc.stringMatching(/^[a-z0-9-]{1,12}$/);

  /** Arbitrary for a relative path */
  const relativePathArb = fc
    .array(pathSegmentArb, { minLength: 1, maxLength: 3 })
    .map((segments) => '/' + segments.join('/'));

  /** Arbitrary for a non-empty link title (must start with alphanumeric to avoid all-whitespace) */
  const titleArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{0,19}$/);

  /** The fixed base domain */
  const BASE_DOMAIN = 'not.ultranx.ru';
  const BASE_URL = `https://${BASE_DOMAIN}/en`;

  /**
   * Generate HTML with duplicate links: each unique path is repeated
   * a random number of times (1-5) inside <article> wrappers.
   */
  const duplicatedCatalogHtmlArb = fc
    .array(
      fc.tuple(relativePathArb, titleArb, fc.integer({ min: 1, max: 5 })),
      { minLength: 1, maxLength: 8 }
    )
    .map((entries) => {
      const anchors: string[] = [];
      for (const [path, title, repeatCount] of entries) {
        const href = `https://${BASE_DOMAIN}${path}`;
        for (let i = 0; i < repeatCount; i++) {
          anchors.push(`<article><a href="${href}">${title}</a></article>`);
        }
      }
      return { html: `<html><body>${anchors.join('\n')}</body></html>`, entries };
    });

  it('should return unique URLs even when the HTML contains duplicate links', () => {
    fc.assert(
      fc.property(duplicatedCatalogHtmlArb, ({ html }) => {
        const links = notUltraNXParser.extractGameLinks(html, BASE_URL);
        const urls = links.map((l) => l.url);
        const uniqueUrls = new Set(urls);

        expect(urls.length).toBe(uniqueUrls.size);
      }),
      { numRuns: 100 }
    );
  });

  it('should return exactly the number of distinct URLs from the input', () => {
    fc.assert(
      fc.property(duplicatedCatalogHtmlArb, ({ html, entries }) => {
        const links = notUltraNXParser.extractGameLinks(html, BASE_URL);

        // Count distinct paths from the generated entries
        const distinctPaths = new Set(
          entries.map(([path]) => `https://${BASE_DOMAIN}${path}`)
        );

        expect(links.length).toBe(distinctPaths.size);
      }),
      { numRuns: 100 }
    );
  });
});
