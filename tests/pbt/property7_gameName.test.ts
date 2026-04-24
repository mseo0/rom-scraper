import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { notUltraNXParser } from '../../src/parsers/notUltraNX';

/**
 * **Validates: Requirements 3.4**
 * Feature: multi-layer-scraping, Property 7: Game Name Extraction From Detail Pages
 *
 * For any detail page HTML that contains a non-empty <h1> element or <title> tag,
 * extractDownloadLinks(html, detailPageUrl) SHALL return a gameName that is a
 * non-empty string derived from the page content.
 */
describe('Feature: multi-layer-scraping, Property 7: Game Name Extraction From Detail Pages', () => {
  /** Arbitrary for a non-empty game name (letters, numbers, spaces, colons, hyphens) */
  const gameNameArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 :'-]{1,40}$/);

  /** A valid detail page URL on the expected domain */
  const DETAIL_URL = 'https://not.ultranx.ru/en/game/123';

  /**
   * Generate detail page HTML with an <h1> containing the game name.
   * Includes an external link so the page has some structure.
   */
  const h1DetailHtmlArb = gameNameArb.map(
    (name) =>
      `<html><head><title>Site Title</title></head><body><h1>${name}</h1><a href="https://mega.nz/file/abc">Download</a></body></html>`
  );

  /**
   * Generate detail page HTML with only a <title> tag (no <h1>).
   */
  const titleOnlyDetailHtmlArb = gameNameArb.map(
    (name) =>
      `<html><head><title>${name}</title></head><body><p>Some content</p><a href="https://mega.nz/file/abc">Download</a></body></html>`
  );

  /**
   * Generate detail page HTML with both <h1> and <title> containing different names.
   * The parser should prefer <h1>.
   */
  const bothElementsHtmlArb = fc
    .tuple(gameNameArb, gameNameArb)
    .map(
      ([h1Name, titleName]) =>
        `<html><head><title>${titleName}</title></head><body><h1>${h1Name}</h1><a href="https://mega.nz/file/abc">Download</a></body></html>`
    );

  it('should extract a non-empty gameName when <h1> is present', () => {
    fc.assert(
      fc.property(h1DetailHtmlArb, (html) => {
        const result = notUltraNXParser.extractDownloadLinks(html, DETAIL_URL);

        expect(result.gameName).toBeTruthy();
        expect(result.gameName.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should extract a non-empty gameName when only <title> is present', () => {
    fc.assert(
      fc.property(titleOnlyDetailHtmlArb, (html) => {
        const result = notUltraNXParser.extractDownloadLinks(html, DETAIL_URL);

        expect(result.gameName).toBeTruthy();
        expect(result.gameName.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should prefer <h1> over <title> when both are present', () => {
    fc.assert(
      fc.property(bothElementsHtmlArb, (html) => {
        const result = notUltraNXParser.extractDownloadLinks(html, DETAIL_URL);

        // The parser should prefer h1 — extract the h1 text from the HTML to compare
        const h1Match = html.match(/<h1>(.*?)<\/h1>/);
        const expectedName = h1Match ? h1Match[1].trim() : '';

        expect(result.gameName).toBeTruthy();
        expect(result.gameName).toBe(expectedName);
      }),
      { numRuns: 100 }
    );
  });
});
