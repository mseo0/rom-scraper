import * as cheerio from 'cheerio';
import { SourceParser, GameLink } from '../types';

/**
 * Source parser for switchgamesmall.icu.
 *
 * Clean catalog visible in static HTML. Also lists PC games,
 * so the parser filters to Switch games only when possible
 * by checking link text, section context, and URL paths.
 */
export const switchGamesMallParser: SourceParser = {
  /**
   * Extract game links from the catalog grid page.
   * Selects game card/entry links, filters to Switch games section
   * if distinguishable, resolves relative URLs, and deduplicates.
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

    // Target game card/entry links from catalog grid structures
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

      // Skip links inside navigation, sidebar, footer, and ad areas
      const $el = $(el);
      if ($el.closest('nav, .nav, .navigation, .menu, footer, .footer, #sidebar, .sidebar, .widget, .ad, .ads, .advertisement, .banner').length > 0) {
        return;
      }

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

      // Skip static assets
      const lower = absoluteUrl.toLowerCase();
      if (lower.endsWith('.css') || lower.endsWith('.js') || lower.endsWith('.png') ||
          lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') ||
          lower.endsWith('.svg') || lower.endsWith('.ico') || lower.endsWith('.webp')) return;

      // Skip root/home page links
      const path = new URL(absoluteUrl).pathname.toLowerCase();
      if (path === '/' || path === '') return;

      // Filter out PC game links if distinguishable by URL path or section context.
      // Keep links that contain "switch" or "nintendo" in the path or title,
      // and exclude links clearly marked as PC-only.
      const title = $el.text().trim() || '';
      const titleLower = title.toLowerCase();
      const pathLower = path.toLowerCase();

      // If the link or its parent section is clearly PC-only, skip it
      const sectionText = $el.closest('section, .category, .section').text().toLowerCase();
      const isPcSection = sectionText.includes('pc game') || sectionText.includes('pc only');
      const isPcLink = (pathLower.includes('/pc/') || pathLower.includes('/pc-game')) &&
                       !pathLower.includes('switch') && !pathLower.includes('nintendo');

      if (isPcSection && !pathLower.includes('switch') && !titleLower.includes('switch') &&
          !titleLower.includes('nintendo')) {
        return;
      }
      if (isPcLink) return;

      // Deduplicate by URL
      if (seen.has(absoluteUrl)) return;
      seen.add(absoluteUrl);

      if (title) {
        links.push({ url: absoluteUrl, title });
      }
    });

    return links;
  },

  /**
   * Extract candidate download URLs from a detail page.
   * Extracts the game name from heading/title elements and
   * finds all external anchor hrefs as download candidates.
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
