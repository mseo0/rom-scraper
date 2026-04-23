import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { nspGameHubParser } from '../../src/parsers/nspGameHub';
import { GameLink, Source } from '../../src/types';

/**
 * **Validates: Requirements 2.1, 2.2**
 * Feature: deep-link-scraping, Property 3: Download URL Extraction Prefers .nsp Links
 *
 * For any detail page HTML containing at least one direct .nsp link,
 * extractDownloadEntry(html, gameLink, source) SHALL return a GameEntry
 * whose downloadUrl ends with .nsp (case-insensitive).
 */

/**
 * Arbitrary: generates a random game name segment.
 */
const gameNameSegmentArb = fc.stringMatching(/^[A-Za-z0-9]{3,12}$/);

/**
 * Arbitrary: generates a random .nsp filename like "MyGame.nsp" or "SomeTitle.NSP".
 */
const nspFilenameArb = fc
  .tuple(
    gameNameSegmentArb,
    fc.constantFrom('.nsp', '.NSP', '.Nsp'),
  )
  .map(([name, ext]) => `${name}${ext}`);

/**
 * Arbitrary: generates a full .nsp download URL.
 */
const nspUrlArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,8}$/),
    nspFilenameArb,
  )
  .map(([domain, filename]) => `https://${domain}.com/downloads/${filename}`);

/**
 * Arbitrary: generates a non-.nsp URL (e.g., a download button link).
 */
const nonNspUrlArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,8}$/),
    fc.stringMatching(/^[a-z0-9]{3,10}$/),
    fc.constantFrom('.zip', '.rar', '.7z', ''),
  )
  .map(([domain, name, ext]) => `https://${domain}.com/download/${name}${ext}`);

/**
 * Arbitrary: generates a non-.nsp anchor element with a download-button class.
 */
const nonNspAnchorArb = nonNspUrlArb.map(
  (url) => `<a class="download-btn" href="${url}">Download</a>`,
);

/**
 * Arbitrary: generates a .nsp anchor element (a direct .nsp link).
 */
const nspAnchorArb = nspUrlArb.map(
  (url) => `<a href="${url}">Download NSP</a>`,
);

/**
 * Arbitrary: generates a valid GameLink.
 */
const gameLinkArb: fc.Arbitrary<GameLink> = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,8}$/),
    gameNameSegmentArb,
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
 * Builds detail page HTML with at least one .nsp link and optionally
 * non-.nsp download button links placed before the .nsp link.
 */
function buildDetailPageHtml(
  nspAnchors: string[],
  nonNspAnchors: string[],
  pageTitle: string,
): string {
  // Place non-.nsp anchors before .nsp anchors to test preference
  const allAnchors = [...nonNspAnchors, ...nspAnchors].join('\n');
  return `<html>
<head><title>${pageTitle}</title></head>
<body>
  <h1>${pageTitle}</h1>
  ${allAnchors}
</body>
</html>`;
}

describe('Feature: deep-link-scraping, Property 3: Download URL Extraction Prefers .nsp Links', () => {
  it('should return a downloadUrl ending with .nsp when .nsp links are present', () => {
    fc.assert(
      fc.property(
        // Generate at least 1 .nsp anchor, 0-5 non-.nsp anchors
        fc.tuple(
          fc.array(nspAnchorArb, { minLength: 1, maxLength: 5 }),
          fc.array(nonNspAnchorArb, { minLength: 0, maxLength: 5 }),
          gameNameSegmentArb,
          gameLinkArb,
          sourceArb,
        ),
        ([nspAnchors, nonNspAnchors, pageTitle, gameLink, source]) => {
          const html = buildDetailPageHtml(nspAnchors, nonNspAnchors, pageTitle);

          const result = nspGameHubParser.extractDownloadEntry(html, gameLink, source);

          // The result must not be null since there's at least one .nsp link
          expect(result).not.toBeNull();

          // The downloadUrl must end with .nsp (case-insensitive)
          expect(
            result!.downloadUrl.toLowerCase().endsWith('.nsp'),
            `Expected downloadUrl to end with .nsp but got: ${result!.downloadUrl}`,
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
