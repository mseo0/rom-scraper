import * as cheerio from 'cheerio';
import { SourceParser, GameLink } from '../types';

/**
 * Source parser for nxbrew.net.
 *
 * Large catalog (1,785+ pages), static HTML, WordPress blog-style layout.
 * FMHY warns about fake download buttons — the parser targets the actual
 * download section within .entry-content and avoids sidebar, ad, and
 * navigation links.
 */
export const nxBrewParser: SourceParser = {
  getSearchUrl(query: string, baseUrl: string): string {
    const origin = new URL(baseUrl).origin;
    return `${origin}/?s=${encodeURIComponent(query)}`;
  },
  /**
   * Extract game links from the paginated blog-style catalog page.
   * Targets post/article title links and avoids sidebar widgets,
   * navigation menus, and ad links. Resolves relative URLs and deduplicates.
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

    // WordPress blog catalog: target post title links specifically.
    // These selectors target the main content area post titles,
    // avoiding sidebar widgets, nav menus, and ad blocks.
    const selectors = [
      '.entry-title a[href]',
      'h2.entry-title a[href]',
      'h1.entry-title a[href]',
      'article .entry-header a[href]',
      'article h2 a[href]',
      '.post h2 a[href]',
      '#main article a[href]',
      '#content article a[href]',
      '.site-main article a[href]',
    ];

    const selectorString = selectors.join(', ');
    let matched = $(selectorString);

    // Fallback: if no structured elements found, look for article links
    // in the main content area only (not sidebar/footer)
    if (matched.length === 0) {
      matched = $('article a[href], .post a[href], .hentry a[href]');
    }

    // Last resort fallback: scan all anchors but filter carefully
    if (matched.length === 0) {
      matched = $('a[href]');
    }

    matched.each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const trimmedHref = href.trim();
      if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return;

      // Skip links inside sidebar, navigation, footer, and ad areas
      const $el = $(el);
      if ($el.closest('#sidebar, .sidebar, .widget-area, .widget, nav, .nav, .navigation, .menu, footer, .footer, .ad, .ads, .advertisement, .banner, #secondary, .secondary').length > 0) {
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

      // Skip static assets, category/tag pages, and utility links
      const lower = absoluteUrl.toLowerCase();
      if (lower.endsWith('.css') || lower.endsWith('.js') || lower.endsWith('.png') ||
          lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') ||
          lower.endsWith('.svg') || lower.endsWith('.ico') || lower.endsWith('.webp')) return;

      // Skip common WordPress non-game pages
      const path = new URL(absoluteUrl).pathname.toLowerCase();
      if (path === '/' || path === '') return;
      if (path.startsWith('/category/') || path.startsWith('/tag/') ||
          path.startsWith('/author/') || path.startsWith('/page/') ||
          path.startsWith('/wp-admin/') || path.startsWith('/wp-login') ||
          path.startsWith('/feed') || path.startsWith('/comments')) return;

      // Deduplicate by URL
      if (seen.has(absoluteUrl)) return;
      seen.add(absoluteUrl);

      const title = $el.text().trim() || '';
      if (title) {
        links.push({ url: absoluteUrl, title });
      }
    });

    return links;
  },

  /**
   * Extract candidate download URLs from a detail page.
   * Extracts the game name from the post title <h1> and targets
   * the actual download section within .entry-content, avoiding
   * fake download buttons and ad links.
   */
  extractDownloadLinks(html: string, detailPageUrl: string): {
    gameName: string;
    urls: string[];
  } {
    const $ = cheerio.load(html);

    // Extract game name: prefer <h1> (post title), then <title>
    let gameName = '';

    const h1Text = $('h1.entry-title').first().text().trim() ||
                   $('h1.post-title').first().text().trim() ||
                   $('h1').first().text().trim();
    if (h1Text) {
      gameName = h1Text;
    }

    if (!gameName) {
      const titleText = $('title').text().trim();
      if (titleText) {
        // WordPress titles often have " – Site Name" suffix; strip it
        gameName = titleText.split(/\s*[–—|]\s*/)[0].trim();
      }
    }

    // Collect download URLs from the main content area only.
    // Target .entry-content (WordPress standard) to avoid sidebar/footer links.
    const urls: string[] = [];
    const seenUrls = new Set<string>();

    let detailDomain: string;
    try {
      detailDomain = new URL(detailPageUrl).hostname;
    } catch {
      detailDomain = '';
    }

    // Select the main content container
    const contentArea = $('.entry-content, .post-content, .entry-inner, article .content, .single-content');

    // If no content area found, fall back to the whole document
    // but still apply external-link filtering
    const searchArea = contentArea.length > 0 ? contentArea : $('body');

    searchArea.find('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const trimmedHref = href.trim();
      if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return;

      const $el = $(el);

      // Skip fake download buttons: these are typically ad links styled as buttons
      // in sidebar, widget areas, or marked with ad-related classes
      if ($el.closest('.sidebar, .widget, .widget-area, #sidebar, #secondary, .ad, .ads, .advertisement, .banner').length > 0) {
        return;
      }

      // Skip elements with ad-related classes or IDs
      const elClass = ($el.attr('class') || '').toLowerCase();
      const elId = ($el.attr('id') || '').toLowerCase();
      if (elClass.includes('fake') || elClass.includes('adsbygoogle') ||
          elId.includes('fake') || elId.includes('adsbygoogle')) {
        return;
      }

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
