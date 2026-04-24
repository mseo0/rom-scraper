import * as cheerio from 'cheerio';
import { SourceParser, GameLink } from '../types';

/**
 * Source parser for not.ultranx.ru/en.
 *
 * Cleanest HTML structure of all sources — static fetch, no Cloudflare.
 * Catalog shows game titles, release dates, and file sizes in a grid layout.
 */
export const notUltraNXParser: SourceParser = {
  /**
   * Extract game links from the catalog/listing page.
   * Selects game card/entry links from the catalog grid,
   * resolves relative URLs to absolute, and deduplicates by URL.
   */
  extractGameLinks(html: string, baseUrl: string): GameLink[] {
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const links: GameLink[] = [];

    let baseDomain: string;
    try {
      baseDomain = new URL(baseUrl).hostname;
    } catch {
      return [];
    }

    // Look for game entry links within common catalog structures:
    // article elements, card containers, grid items, or list entries
    const selectors = [
      'article a[href]',
      '.game-card a[href]',
      '.game-item a[href]',
      '.card a[href]',
      '.catalog a[href]',
      '.games-list a[href]',
      '.grid a[href]',
      '.entry a[href]',
      '.post a[href]',
      '.item a[href]',
    ];

    const selectorString = selectors.join(', ');
    let matched = $(selectorString);

    // Fallback: if no structured elements found, scan all anchors
    // but filter to same-domain links that look like detail pages
    if (matched.length === 0) {
      matched = $('a[href]');
    }

    matched.each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const trimmedHref = href.trim();
      if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return;

      // Resolve relative URLs to absolute
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(trimmedHref, baseUrl).href;
      } catch {
        return;
      }

      // Filter to same-domain links only (detail pages are on the same site)
      let linkDomain: string;
      try {
        linkDomain = new URL(absoluteUrl).hostname;
      } catch {
        return;
      }

      if (linkDomain !== baseDomain) return;

      // Skip catalog/navigation/utility links
      const lower = absoluteUrl.toLowerCase();
      if (lower.endsWith('.css') || lower.endsWith('.js') || lower.endsWith('.png') ||
          lower.endsWith('.jpg') || lower.endsWith('.svg') || lower.endsWith('.ico')) return;

      // Deduplicate by URL
      if (seen.has(absoluteUrl)) return;
      seen.add(absoluteUrl);

      const title = $(el).text().trim() || '';
      if (title) {
        links.push({ url: absoluteUrl, title });
      }
    });

    return links;
  },

  /**
   * Extract candidate download URLs from a detail page.
   * Extracts the game name from heading/title elements and
   * finds all anchor hrefs that could be download links.
   */
  extractDownloadLinks(html: string, detailPageUrl: string): {
    gameName: string;
    urls: string[];
  } {
    const $ = cheerio.load(html);

    // Extract game name: prefer <h1>, then <title>
    let gameName = '';

    const h1Text = $('h1').first().text().trim();
    if (h1Text) {
      gameName = h1Text;
    }

    if (!gameName) {
      const titleText = $('title').text().trim();
      if (titleText) {
        gameName = titleText;
      }
    }

    // Collect all external anchor hrefs as candidate download URLs.
    // The orchestrator will filter these through the file host registry.
    const urls: string[] = [];
    const seenUrls = new Set<string>();

    let detailDomain: string;
    try {
      detailDomain = new URL(detailPageUrl).hostname;
    } catch {
      detailDomain = '';
    }

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const trimmedHref = href.trim();
      if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return;

      // Resolve relative URLs
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(trimmedHref, detailPageUrl).href;
      } catch {
        return;
      }

      // Only collect external links (different domain) as download candidates
      let linkDomain: string;
      try {
        linkDomain = new URL(absoluteUrl).hostname;
      } catch {
        return;
      }

      if (detailDomain && linkDomain === detailDomain) return;

      // Deduplicate
      if (seenUrls.has(absoluteUrl)) return;
      seenUrls.add(absoluteUrl);

      urls.push(absoluteUrl);
    });

    return { gameName, urls };
  },
};
