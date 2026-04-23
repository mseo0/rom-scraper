import { Source, GameEntry, ParseResult } from './types';
import { parseFmhy } from './parsers/fmhy';
import { parseRetrogrados } from './parsers/retrogrados';
import { parseSwitchrom } from './parsers/switchrom';
import { parseNswtl } from './parsers/nswtl';
import { parseSwitchRomsOrg } from './parsers/switchRomsOrg';
import { parseRomenix } from './parsers/romenix';

const parserMap: Record<string, (html: string) => GameEntry[]> = {
  FMHY: parseFmhy,
  RetrogradosGaming: parseRetrogrados,
  SwitchRom: parseSwitchrom,
  NSWTL: parseNswtl,
  SwitchRomsOrg: parseSwitchRomsOrg,
  Romenix: parseRomenix,
};

/**
 * Routes HTML to the correct source-specific parser based on source.name.
 * Returns a ParseResult with extracted entries or a descriptive message.
 */
export function parseSource(source: Source, html: string): ParseResult {
  const parser = parserMap[source.name];

  if (!parser) {
    return { source, entries: [], message: `Unknown source: ${source.name}` };
  }

  const entries = parser(html);

  return {
    source,
    entries,
    message: entries.length === 0 ? `No .nsp files found on ${source.name}` : null,
  };
}

/**
 * Returns true if the URL path ends with .nsp (case-insensitive).
 * Handles URLs with query strings and fragments by checking the path portion only.
 */
export function isNspLink(url: string): boolean {
  if (!url) return false;

  try {
    // Try parsing as a full URL to extract the pathname
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith('.nsp');
  } catch {
    // If URL parsing fails (e.g. relative path), strip query/fragment manually
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
  // 1. If linkText is non-empty after trimming, use it
  const trimmed = linkText.trim();
  if (trimmed) return trimmed;

  // 2. Extract filename from URL
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // Strip query/fragment manually for relative URLs
    const withoutFragment = url.split('#')[0];
    pathname = withoutFragment.split('?')[0];
  }

  // Get the last path segment
  const segments = pathname.split('/');
  let filename = segments[segments.length - 1] || '';

  // 3. Remove .nsp extension (case-insensitive)
  filename = filename.replace(/\.nsp$/i, '');

  // 4. Decode URI components and replace common separators with spaces
  try {
    filename = decodeURIComponent(filename);
  } catch {
    // If decoding fails, manually replace %20
    filename = filename.replace(/%20/g, ' ');
  }
  filename = filename.replace(/[-_]/g, ' ').trim();

  // 5. Return cleaned name or fallback
  return filename || 'Unknown Game';
}
