import * as cheerio from 'cheerio';
import { SourceParser, GameLink } from '../types';

/**
 * Source parser for not.ultranx.ru/en.
 *
 * Cleanest HTML structure of all sources — static fetch, no Cloudflare.
 * Catalog shows game titles, release dates, and file sizes in a grid layout.
 */
export const notUltraNXParser: SourceParser = {
  getNewReleasesUrl(baseUrl: string): string {
    // The default catalog page already shows games ordered by release date
    // (most recent first), so we return the base URL directly.
    return baseUrl;
  },

  getSearchUrl(query: string, baseUrl: string): string {
    return `${baseUrl}?s=${encodeURIComponent(query)}`;
  },
  /**
   * Extract game links from the catalog/listing page.
   * Selects game card/entry links from the catalog grid,
   * resolves relative URLs to absolute, and deduplicates by URL.
   */
  extractGameLinks(html: string, baseUrl: string): GameLink[] {
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const links: GameLink[] = [];

    // notUltraNX uses <div class="card" data-href="en/game/..."> for game entries
    // with <div class="card-title"> for the game name. No <a> tags for game links.
    $('div.card[data-href]').each((_, el) => {
      const dataHref = $(el).attr('data-href');
      if (!dataHref) return;

      const trimmedHref = dataHref.trim();
      if (!trimmedHref) return;

      // Resolve relative data-href to absolute URL
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(trimmedHref, baseUrl).href;
      } catch {
        return;
      }

      // Deduplicate by URL
      if (seen.has(absoluteUrl)) return;
      seen.add(absoluteUrl);

      const title = $(el).find('.card-title').first().text().trim() || '';
      if (title) {
        links.push({ url: absoluteUrl, title });
      }
    });

    // Fallback: also check <a> tags inside structured elements
    // in case the site changes its markup
    if (links.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const trimmedHref = href.trim();
        if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:') || trimmedHref.startsWith('?')) return;

        let absoluteUrl: string;
        try {
          absoluteUrl = new URL(trimmedHref, baseUrl).href;
        } catch {
          return;
        }

        // Only game detail pages (contain /game/ in path)
        if (!absoluteUrl.includes('/game/')) return;

        if (seen.has(absoluteUrl)) return;
        seen.add(absoluteUrl);

        const title = $(el).text().trim() || '';
        if (title) {
          links.push({ url: absoluteUrl, title });
        }
      });
    }

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
        // Strip site prefix like "notUltraNX - "
        gameName = titleText.replace(/^notUltraNX\s*-\s*/i, '').trim();
      }
    }

    // notUltraNX has download links in <div class="download-buttons">
    // pointing to api.ultranx.ru/games/download/...
    const urls: string[] = [];
    const seenUrls = new Set<string>();

    // First: look for download buttons (the primary download mechanism)
    $('.download-buttons a[href], .download-section a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const trimmedHref = href.trim();
      if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return;

      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(trimmedHref, detailPageUrl).href;
      } catch {
        return;
      }

      if (seenUrls.has(absoluteUrl)) return;
      seenUrls.add(absoluteUrl);

      urls.push(absoluteUrl);
    });

    // Fallback: collect all external links if no download buttons found
    if (urls.length === 0) {
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

        let absoluteUrl: string;
        try {
          absoluteUrl = new URL(trimmedHref, detailPageUrl).href;
        } catch {
          return;
        }

        let linkDomain: string;
        try {
          linkDomain = new URL(absoluteUrl).hostname;
        } catch {
          return;
        }

        if (detailDomain && linkDomain === detailDomain) return;

        if (seenUrls.has(absoluteUrl)) return;
        seenUrls.add(absoluteUrl);

        urls.push(absoluteUrl);
      });
    }

    return { gameName, urls };
  },
};
