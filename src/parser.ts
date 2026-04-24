import { Source, GameEntry, ParseResult, SourceParser } from './types';
import { notUltraNXParser } from './parsers/notUltraNX';
import { nxBrewParser } from './parsers/nxBrew';

export const sourceParserMap: Record<string, SourceParser> = {
  notUltraNX: notUltraNXParser,
  NXBrew: nxBrewParser,
};

export function getSourceParser(sourceName: string): SourceParser | undefined {
  return sourceParserMap[sourceName];
}

/**
 * Routes HTML to the correct source-specific parser based on source.name.
 * Returns a ParseResult with extracted entries or a descriptive message.
 */
export function parseSource(source: Source, html: string): ParseResult {
  return { source, entries: [], message: `Unknown source: ${source.name}` };
}

/**
 * Returns true if the URL path ends with .nsp (case-insensitive).
 * Handles URLs with query strings and fragments by checking the path portion only.
 */
export function isNspLink(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith('.nsp');
  } catch {
    const withoutFragment = url.split('#')[0];
    const withoutQuery = withoutFragment.split('?')[0];
    return withoutQuery.toLowerCase().endsWith('.nsp');
  }
}

/**
 * Extracts a game name from link text or the URL filename.
 * Prefers link text when available; falls back to cleaning up the URL filename.
 * Always returns a non-empty string (defaults to "Unknown Game").
 */
export function extractGameName(linkText: string, url: string): string {
  const trimmed = linkText.trim();
  if (trimmed) return trimmed;

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    const withoutFragment = url.split('#')[0];
    pathname = withoutFragment.split('?')[0];
  }

  const segments = pathname.split('/');
  let filename = segments[segments.length - 1] || '';

  filename = filename.replace(/\.nsp$/i, '');

  try {
    filename = decodeURIComponent(filename);
  } catch {
    filename = filename.replace(/%20/g, ' ');
  }
  filename = filename.replace(/[-_]/g, ' ').trim();

  return filename || 'Unknown Game';
}
