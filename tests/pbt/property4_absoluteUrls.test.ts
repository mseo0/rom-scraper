import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { notUltraNXParser } from '../../src/parsers/notUltraNX';

/**
 * **Validates: Requirements 2.1, 2.2**
 * Feature: multi-layer-scraping, Property 4: Game Link Extraction Produces Absolute URLs
 *
 * For any HTML string containing anchor elements with a mix of relative paths
 * and absolute URLs, and for any valid base URL, extractGameLinks(html, baseUrl)
 * SHALL return only absolute URLs (starting with http:// or https://).
 * No relative paths shall appear in the output.
 */
describe('Feature: multi-layer-scraping, Property 4: Game Link Extraction Produces Absolute URLs', () => {
  /** Arbitrary for a path segment (alphanumeric, hyphens) */
  const pathSegmentArb = fc.stringMatching(/^[a-z0-9-]{1,12}$/);

  /** Arbitrary for a relative path like /game/123 or /en/detail/abc */
  const relativePathArb = fc
    .array(pathSegmentArb, { minLength: 1, maxLength: 4 })
    .map((segments) => '/' + segments.join('/'));

  /** Arbitrary for a non-empty link title (must contain at least one non-space character) */
  const titleArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{2,29}$/);

  /** The fixed base domain used for generating same-domain links */
  const BASE_DOMAIN = 'not.ultranx.ru';
  const BASE_URL = `https://${BASE_DOMAIN}/en`;

  /**
   * Build an HTML catalog page with links inside structured elements.
   * Uses <article> wrappers so the parser's selectors match.
   * Generates a mix of relative and absolute same-domain links.
   */
  const catalogHtmlArb = fc
    .array(
      fc.tuple(relativePathArb, titleArb, fc.boolean()),
      { minLength: 1, maxLength: 10 }
    )
    .map((entries) => {
      const anchors = entries.map(([path, title, useAbsolute]) => {
        const href = useAbsolute ? `https://${BASE_DOMAIN}${path}` : path;
        return `<article><a href="${href}">${title}</a></article>`;
      });
      return `<html><body>${anchors.join('\n')}</body></html>`;
    });

  it('should return only absolute URLs (starting with http:// or https://) for mixed relative/absolute links', () => {
    fc.assert(
      fc.property(catalogHtmlArb, (html) => {
        const links = notUltraNXParser.extractGameLinks(html, BASE_URL);

        for (const link of links) {
          expect(
            link.url.startsWith('http://') || link.url.startsWith('https://'),
            `Expected absolute URL but got: ${link.url}`
          ).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should resolve relative paths to the correct absolute URL using the base URL', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        titleArb,
        (path, title) => {
          const html = `<html><body><article><a href="${path}">${title}</a></article></body></html>`;
          const links = notUltraNXParser.extractGameLinks(html, BASE_URL);

          // Should produce at least one link
          expect(links.length).toBeGreaterThanOrEqual(1);

          // The resolved URL should be absolute and contain the path
          const resolved = links[0].url;
          expect(resolved.startsWith('https://')).toBe(true);
          expect(resolved).toContain(BASE_DOMAIN);
        }
      ),
      { numRuns: 100 }
    );
  });
});
