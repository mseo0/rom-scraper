import * as cheerio from 'cheerio';
import { GameEntry, GameLink, Source, DeepLinkParser } from '../types';
import { isNspLink, extractGameName } from '../parser';

/**
 * Deep link parser for NspGameHub.
 *
 * Listing pages contain links to individual game detail pages.
 * Detail pages contain the actual .nsp download link or a download button.
 */
export const nspGameHubParser: DeepLinkParser = {
  /**
   * Extract game links from a listing page.
   * - Parses HTML with cheerio
   * - Selects <a> elements with href attributes
   * - Resolves relative URLs to absolute using baseUrl
   * - Filters to same-domain links only
   * - Deduplicates by URL
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

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Skip empty, anchor-only, and javascript: links
      const trimmedHref = href.trim();
      if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return;

      // Resolve relative URLs to absolute
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(trimmedHref, baseUrl).href;
      } catch {
        return;
      }

      // Filter to same-domain links only
      let linkDomain: string;
      try {
        linkDomain = new URL(absoluteUrl).hostname;
      } catch {
        return;
      }

      if (linkDomain !== baseDomain) return;

      // Deduplicate by URL
      if (seen.has(absoluteUrl)) return;
      seen.add(absoluteUrl);

      const title = $(el).text().trim() || '';
      links.push({ url: absoluteUrl, title });
    });

    return links;
  },

  /**
   * Extract a download entry from a detail page.
   * - Prefers direct .nsp links (using isNspLink)
   * - Falls back to download button/link selectors
   * - Extracts game name from <title>, <h1>, or gameLink.title
   * - Returns null if no download URL is found
   */
  extractDownloadEntry(html: string, gameLink: GameLink, source: Source): GameEntry | null {
    const $ = cheerio.load(html);

    // 1. Look for direct .nsp links first
    let downloadUrl: string | null = null;

    $('a[href]').each((_, el) => {
      if (downloadUrl) return; // already found one
      const href = $(el).attr('href') || '';
      if (isNspLink(href)) {
        downloadUrl = href;
      }
    });

    // 2. Fall back to download button/link selectors
    if (!downloadUrl) {
      const fallbackSelectors = [
        'a.download-btn',
        'a[href*="download"]',
        'a.btn-download',
        'a.btn',
      ];

      for (const selector of fallbackSelectors) {
        const el = $(selector).first();
        if (el.length > 0) {
          const href = el.attr('href');
          if (href && href.trim()) {
            downloadUrl = href.trim();
            break;
          }
        }
      }
    }

    // 3. If no download URL found, return null
    if (!downloadUrl) return null;

    // 4. Extract game name: prefer <title>, then <h1>, then gameLink.title
    let gameName = '';

    const titleTag = $('title').text().trim();
    if (titleTag) {
      gameName = titleTag;
    }

    if (!gameName) {
      const h1Text = $('h1').first().text().trim();
      if (h1Text) {
        gameName = h1Text;
      }
    }

    if (!gameName) {
      gameName = gameLink.title || '';
    }

    // Final fallback using extractGameName utility
    if (!gameName) {
      gameName = extractGameName('', downloadUrl);
    }

    return {
      index: 0,
      gameName,
      downloadUrl,
      sourceName: source.name,
      sourceUrl: source.url,
      detailPageUrl: gameLink.url,
    };
  },
};
