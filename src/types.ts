import { DownloadLink } from './fileHosts';

export interface Source {
  url: string;
  name: string;
  requiresJs: boolean;
  deepLink?: boolean;
}

export interface GameEntry {
  index: number;
  gameName: string;
  downloadLinks?: DownloadLink[];  // All file host links for this game
  downloadUrl: string;             // First download link URL (backward compat)
  sourceName: string;
  sourceUrl: string;
  detailPageUrl?: string;
}

export interface SourceParser {
  /**
   * Extract game links from a catalog/listing page.
   * Returns GameLink[] with absolute URLs to detail pages.
   */
  extractGameLinks(html: string, baseUrl: string): GameLink[];

  /**
   * Extract candidate download URLs from a detail page.
   * Returns raw URLs found on the page — the orchestrator
   * runs these through the file host registry and intermediary filter.
   *
   * Also extracts the game name from the page content.
   */
  extractDownloadLinks(html: string, detailPageUrl: string): {
    gameName: string;
    urls: string[];
  };

  /**
   * Build a search URL for this source given a query string.
   * If not implemented, the orchestrator uses the default catalog URL.
   */
  getSearchUrl?(query: string, baseUrl: string): string;
}

export interface FetchResult {
  source: Source;
  html: string | null;
  error: string | null;
}

export interface ParseResult {
  source: Source;
  entries: GameEntry[];
  message: string | null;
}

export interface GameLink {
  url: string;
  title: string;
}

export interface DetailPageResult {
  gameLink: GameLink;
  html: string | null;
  error: string | null;
}

export interface DeepLinkParser {
  extractGameLinks(html: string, baseUrl: string): GameLink[];
  extractDownloadEntry(html: string, gameLink: GameLink, source: Source): GameEntry | null;
}
