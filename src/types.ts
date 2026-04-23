export interface Source {
  url: string;
  name: string;
  requiresJs: boolean;
}

export interface GameEntry {
  index: number;
  gameName: string;
  downloadUrl: string;
  sourceName: string;
  sourceUrl: string;
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
