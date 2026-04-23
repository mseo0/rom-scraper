export interface Source {
  url: string;
  name: string;
  requiresJs: boolean;
  deepLink?: boolean;
}

export interface GameEntry {
  index: number;
  gameName: string;
  downloadUrl: string;
  sourceName: string;
  sourceUrl: string;
  detailPageUrl?: string;
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
