import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { notUltraNXParser } from '../../src/parsers/notUltraNX';

/**
 * **Validates: Requirements 2.3**
 * Feature: multi-layer-scraping, Property 5: Game Link Deduplication
 *
 * For any HTML string containing duplicate game card elements pointing to the same
 * detail page URL, extractGameLinks(html, baseUrl) SHALL return a list where
 * every URL is unique — the length of the result equals the number of distinct
 * matching URLs in the input.
 */
describe('Feature: multi-layer-scraping, Property 5: Game Link Deduplication', () => {
  /** Arbitrary for a path segment */
  const pathSegmentArb = fc.stringMatching(/^[a-z0-9-]{1,12}$/);

  /** Arbitrary for a game path like en/game/abc123 */
  const gamePathArb = fc
    .array(pathSegmentArb, { minLength: 1, maxLength: 3 })
    .map((segments) => 'en/game/' + segments.join('/'));

  /** Arbitrary for a non-empty link title (must start with alphanumeric) */
  const titleArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{0,19}$/);

  /** The fixed base domain */
  const BASE_DOMAIN = 'not.ultranx.ru';
  const BASE_URL = `https://${BASE_DOMAIN}/en`;

  /**
   * Generate HTML with duplicate card elements: each unique path is repeated
   * a random number of times (1-5) using div.card[data-href].
   */
  const duplicatedCatalogHtmlArb = fc
    .array(
      fc.tuple(gamePathArb, titleArb, fc.integer({ min: 1, max: 5 })),
      { minLength: 1, maxLength: 8 }
    )
    .map((entries) => {
      const cards: string[] = [];
      for (const [path, title, repeatCount] of entries) {
        const href = `https://${BASE_DOMAIN}/${path}`;
        for (let i = 0; i < repeatCount; i++) {
          cards.push(`<div class="card cursor-pointer" data-href="${href}"><div class="card-content"><div class="card-title">${title}</div></div></div>`);
        }
      }
      return { html: `<html><body><div class="card-container">${cards.join('\n')}</div></body></html>`, entries };
    });

  it('should return unique URLs even when the HTML contains duplicate cards', () => {
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
          entries.map(([path]) => `https://${BASE_DOMAIN}/${path}`)
        );

        expect(links.length).toBe(distinctPaths.size);
      }),
      { numRuns: 100 }
    );
  });
});
