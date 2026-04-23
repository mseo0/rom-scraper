import { GameEntry } from './types';

export function searchGames(query: string, entries: GameEntry[]): GameEntry[] {
  const lowerQuery = query.trim().toLowerCase();
  return entries
    .filter((entry) => entry.gameName.toLowerCase().includes(lowerQuery))
    .map((entry, i) => ({ ...entry, index: i + 1 }));
}
