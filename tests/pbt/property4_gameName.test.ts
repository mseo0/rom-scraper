import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { nspGameHubParser } from '../../src/parsers/nspGameHub';
import { GameLink, Source } from '../../src/types';

/**
 * **Validates: Requirements 2.5**
 * Feature: deep-link-scraping, Property 4: Game Name Extraction from Detail Pages
 *
 * For any detail page HTML that contains a non-empty page title or <h1> element,
 * extractDownloadEntry(html, gameLink, source) SHALL return a GameEntry whose
 * gameName is a non-empty string derived from the page content (not falling back
 * to "Unknown Game").
 */

/**
 * Arbitrary: generates a non-empty game name string (alphanumeric with spaces).
 */
const gameNameArb = fc
  .array(fc.stringMatching(/^[A-Za-z0-9]{1,10}$/), { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join(' '));

/**
 * Arbitrary: generates a random .nsp download URL to ensure extractDownloadEntry returns non-null.
 */
const nspUrlArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,8}$/),
    fc.stringMatching(/^[A-Za-z0-9]{3,12}$/),
    fc.constantFrom('.nsp', '.NSP', '.Nsp'),
  )
  .map(([domain, filename, ext]) => `https://${domain}.com/downloads/${filename}${ext}`);

/**
 * Arbitrary: generates a valid GameLink.
 */
const gameLinkArb: fc.Arbitrary<GameLink> = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,8}$/),
    fc.stringMatching(/^[A-Za-z0-9]{3,10}$/),
  )
  .map(([domain, name]) => ({
    url: `https://${domain}.com/games/${name}`,
    title: `Game ${name}`,
  }));

/**
 * Arbitrary: generates a valid Source with deepLink enabled.
 */
const sourceArb: fc.Arbitrary<Source> = fc
  .stringMatching(/^[a-z]{3,8}$/)
  .map((name) => ({
    url: `https://${name}.com`,
    name: `Source_${name}`,
    requiresJs: false,
    deepLink: true,
  }));

/**
 * Strategy for where the game name appears in the HTML.
 * - 'title': game name in <title> tag only
 * - 'h1': game name in <h1> tag only
 * - 'both': game name in both <title> and <h1>
 */
const nameLocationArb = fc.constantFrom('title' as const, 'h1' as const, 'both' as const);

/**
 * Builds detail page HTML with a game name in the specified location(s)
 * and at least one .nsp download link.
 */
function buildDetailPageHtml(
  gameName: string,
  nameLocation: 'title' | 'h1' | 'both',
  nspUrl: string,
): string {
  const titleTag = nameLocation === 'title' || nameLocation === 'both'
    ? `<title>${gameName}</title>`
    : '<title></title>';

  const h1Tag = nameLocation === 'h1' || nameLocation === 'both'
    ? `<h1>${gameName}</h1>`
    : '';

  return `<html>
<head>${titleTag}</head>
<body>
  ${h1Tag}
  <a href="${nspUrl}">Download NSP</a>
</body>
</html>`;
}

describe('Feature: deep-link-scraping, Property 4: Game Name Extraction from Detail Pages', () => {
  it('should extract a non-empty gameName from page content (title or h1), never falling back to "Unknown Game"', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          gameNameArb,
          nameLocationArb,
          nspUrlArb,
          gameLinkArb,
          sourceArb,
        ),
        ([gameName, nameLocation, nspUrl, gameLink, source]) => {
          const html = buildDetailPageHtml(gameName, nameLocation, nspUrl);

          const result = nspGameHubParser.extractDownloadEntry(html, gameLink, source);

          // The result must not be null since there's a .nsp link in the HTML
          expect(result).not.toBeNull();

          // The gameName must be a non-empty string
          expect(result!.gameName).toBeTruthy();
          expect(typeof result!.gameName).toBe('string');
          expect(result!.gameName.trim().length).toBeGreaterThan(0);

          // The gameName must NOT be the fallback "Unknown Game"
          expect(result!.gameName).not.toBe('Unknown Game');

          // The gameName should be derived from the page content
          // When title is present, it takes priority; otherwise h1 is used
          if (nameLocation === 'title' || nameLocation === 'both') {
            expect(result!.gameName).toBe(gameName);
          } else {
            // h1 only
            expect(result!.gameName).toBe(gameName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
