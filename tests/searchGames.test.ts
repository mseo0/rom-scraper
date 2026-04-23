import { describe, it, expect } from 'vitest';
import { searchGames } from '../src/search';
import { GameEntry } from '../src/types';

function makeEntry(index: number, gameName: string, sourceName = 'TestSource'): GameEntry {
  return {
    index,
    gameName,
    downloadUrl: `https://example.com/${gameName.replace(/\s/g, '-').toLowerCase()}.nsp`,
    sourceName,
    sourceUrl: 'https://example.com',
  };
}

describe('searchGames', () => {
  const entries: GameEntry[] = [
    makeEntry(1, 'Super Mario Bros Wonder', 'SourceA'),
    makeEntry(2, 'The Legend of Zelda TOTK', 'SourceB'),
    makeEntry(3, 'Mario Kart 8 Deluxe', 'SourceA'),
    makeEntry(4, 'Metroid Dread', 'SourceC'),
    makeEntry(5, 'Zelda Links Awakening', 'SourceB'),
  ];

  it('filters by case-insensitive substring match', () => {
    const result = searchGames('zelda', entries);
    expect(result).toHaveLength(2);
    expect(result[0].gameName).toBe('The Legend of Zelda TOTK');
    expect(result[1].gameName).toBe('Zelda Links Awakening');
  });

  it('re-indexes results starting from 1', () => {
    const result = searchGames('zelda', entries);
    expect(result[0].index).toBe(1);
    expect(result[1].index).toBe(2);
  });

  it('matches multi-word queries as a single substring', () => {
    const result = searchGames('Mario Bros', entries);
    expect(result).toHaveLength(1);
    expect(result[0].gameName).toBe('Super Mario Bros Wonder');
  });

  it('includes entries from multiple sources', () => {
    const result = searchGames('mario', entries);
    expect(result).toHaveLength(2);
    const sources = result.map((e) => e.sourceName);
    expect(sources).toContain('SourceA');
  });

  it('trims leading and trailing whitespace from query', () => {
    const result = searchGames('  zelda  ', entries);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no matches', () => {
    const result = searchGames('pokemon', entries);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty entries', () => {
    const result = searchGames('zelda', []);
    expect(result).toEqual([]);
  });

  it('handles uppercase query matching lowercase game name', () => {
    const result = searchGames('METROID', entries);
    expect(result).toHaveLength(1);
    expect(result[0].gameName).toBe('Metroid Dread');
    expect(result[0].index).toBe(1);
  });
});
