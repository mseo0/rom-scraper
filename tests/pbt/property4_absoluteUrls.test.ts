import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { notUltraNXParser } from '../../src/parsers/notUltraNX';

/**
 * **Validates: Requirements 2.1, 2.2**
 * Feature: multi-layer-scraping, Property 4: Game Link Extraction Produces Absolute URLs
 *
 * For any HTML string containing game card elements with a mix of relative paths
 * and absolute URLs, and for any valid base URL, extractGameLinks(html, baseUrl)
 * SHALL return only absolute URLs (starting with http:// or https://).
 * No relative paths shall appear in the output.
 */
describe('Feature: multi-layer-scraping, Property 4: Game Link Extraction Produces Absolute URLs', () => {
  /** Arbitrary for a path segment (alphanumeric, hyphens) */
  const pathSegmentArb = fc.stringMatching(/^[a-z0-9-]{1,12}$/);

  /** Arbitrary for a relative path like en/game/123 */
  const relativePathArb = fc
    .array(pathSegmentArb, { minLength: 1, maxLength: 4 })
    .map((segments) => 'en/game/' + segments.join('/'));

  /** Arbitrary for a non-empty link title (must contain at least one non-space character) */
  const titleArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{2,29}$/);

  /** The fixed base domain used for generating same-domain links */
  const BASE_DOMAIN = 'not.ultranx.ru';
  const BASE_URL = `https://${BASE_DOMAIN}/en`;

  /**
   * Build an HTML catalog page with div.card[data-href] elements.
   * Uses the real notUltraNX structure.
   * Generates a mix of relative and absolute same-domain data-href values.
   */
  const catalogHtmlArb = fc
    .array(
      fc.tuple(relativePathArb, titleArb, fc.boolean()),
      { minLength: 1, maxLength: 10 }
    )
    .map((entries) => {
      const cards = entries.map(([path, title, useAbsolute]) => {
        const href = useAbsolute ? `https://${BASE_DOMAIN}/${path}` : path;
        return `<div class="card cursor-pointer" data-href="${href}"><div class="card-content"><div class="card-title">${title}</div></div></div>`;
      });
      return `<html><body><div class="card-container">${cards.join('\n')}</div></body></html>`;
    });

  it('should return only absolute URLs (starting with http:// or https://) for mixed relative/absolute data-href values', () => {
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

  it('should resolve relative data-href paths to the correct absolute URL using the base URL', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        titleArb,
        (path, title) => {
          const html = `<html><body><div class="card" data-href="${path}"><div class="card-title">${title}</div></div></body></html>`;
          const links = notUltraNXParser.extractGameLinks(html, BASE_URL);

          // Should produce at least one link
          expect(links.length).toBeGreaterThanOrEqual(1);

          // The resolved URL should be absolute and contain the domain
          const resolved = links[0].url;
          expect(resolved.startsWith('https://')).toBe(true);
          expect(resolved).toContain(BASE_DOMAIN);
        }
      ),
      { numRuns: 100 }
    );
  });
});
