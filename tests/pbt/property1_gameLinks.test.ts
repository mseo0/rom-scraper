import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { nspGameHubParser } from '../../src/parsers/nspGameHub';

/**
 * **Validates: Requirements 1.1, 1.2**
 * Feature: deep-link-scraping, Property 1: Game Link Extraction Produces Absolute Same-Domain URLs
 *
 * For any HTML string containing anchor elements with a mix of relative paths,
 * absolute same-domain URLs, and external-domain URLs, and for any valid base URL,
 * extractGameLinks(html, baseUrl) SHALL return only absolute URLs whose domain
 * matches the base URL domain. No relative URLs or external-domain URLs shall
 * appear in the output.
 */

/**
 * Arbitrary: generates a simple domain name like "example" or "mysite".
 */
const domainNameArb = fc.stringMatching(/^[a-z]{3,10}$/);

/**
 * Arbitrary: generates a valid base URL like https://example.com
 */
const baseUrlArb = domainNameArb.map((name) => `https://${name}.com`);

/**
 * Arbitrary: generates a relative path like /game/123 or /page/details
 */
const relativePathArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,8}$/),
    fc.stringMatching(/^[a-z0-9]{1,8}$/),
  )
  .map(([segment1, segment2]) => `/${segment1}/${segment2}`);

/**
 * Arbitrary: generates an external domain name different from the base domain.
 */
const externalDomainArb = domainNameArb.map((name) => `${name}-other`);

/**
 * Arbitrary: generates a link descriptor with type and href.
 */
type LinkDescriptor = {
  type: 'relative' | 'same-domain' | 'external';
  href: string;
  title: string;
};

function linkDescriptorArb(baseDomain: string): fc.Arbitrary<LinkDescriptor> {
  const relativeLinkArb = relativePathArb.map(
    (path): LinkDescriptor => ({
      type: 'relative',
      href: path,
      title: `Relative ${path}`,
    }),
  );

  const sameDomainLinkArb = relativePathArb.map(
    (path): LinkDescriptor => ({
      type: 'same-domain',
      href: `https://${baseDomain}.com${path}`,
      title: `SameDomain ${path}`,
    }),
  );

  const externalLinkArb = fc
    .tuple(externalDomainArb, relativePathArb)
    .map(
      ([extDomain, path]): LinkDescriptor => ({
        type: 'external',
        href: `https://${extDomain}.com${path}`,
        title: `External ${path}`,
      }),
    );

  return fc.oneof(relativeLinkArb, sameDomainLinkArb, externalLinkArb);
}

/**
 * Builds an HTML string from an array of link descriptors.
 */
function buildHtml(links: LinkDescriptor[]): string {
  const anchors = links
    .map((link) => `<a href="${link.href}">${link.title}</a>`)
    .join('\n');
  return `<html><body>${anchors}</body></html>`;
}

describe('Feature: deep-link-scraping, Property 1: Game Link Extraction Produces Absolute Same-Domain URLs', () => {
  it('should return only absolute same-domain URLs from mixed HTML links', () => {
    fc.assert(
      fc.property(
        domainNameArb.chain((baseDomain) =>
          fc
            .array(linkDescriptorArb(baseDomain), { minLength: 1, maxLength: 20 })
            .map((links) => ({
              baseDomain,
              baseUrl: `https://${baseDomain}.com`,
              links,
            })),
        ),
        ({ baseUrl, baseDomain, links }) => {
          const html = buildHtml(links);
          const result = nspGameHubParser.extractGameLinks(html, baseUrl);

          const expectedDomain = `${baseDomain}.com`;

          for (const gameLink of result) {
            // All returned URLs must be absolute (start with http:// or https://)
            expect(
              gameLink.url.startsWith('http://') || gameLink.url.startsWith('https://'),
              `Expected absolute URL but got: ${gameLink.url}`,
            ).toBe(true);

            // All returned URLs must have the same domain as the base URL
            const linkDomain = new URL(gameLink.url).hostname;
            expect(linkDomain).toBe(expectedDomain);
          }

          // No relative URLs should appear in the output
          for (const gameLink of result) {
            expect(gameLink.url.startsWith('/')).toBe(false);
          }

          // No external-domain URLs should appear in the output
          const externalLinks = links.filter((l) => l.type === 'external');
          const externalHrefs = new Set(externalLinks.map((l) => l.href));
          for (const gameLink of result) {
            expect(externalHrefs.has(gameLink.url)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
