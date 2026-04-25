import { MergedEntry } from './types';

/**
 * Strip diacritics/accents from a string.
 * Decomposes characters (é → e + combining accent) then removes the combining marks.
 */
function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function searchGames(query: string, entries: MergedEntry[]): MergedEntry[] {
  const normalizedQuery = stripAccents(query.trim().toLowerCase());
  return entries
    .filter((entry) => stripAccents(entry.gameName.toLowerCase()).includes(normalizedQuery))
    .map((entry, i) => ({ ...entry, index: i + 1 }));
}
