import { describe, it, expect } from 'vitest';
import { formatSearchResults } from '../src/formatter';
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

describe('formatSearchResults', () => {
  it('displays "No games found" message when results are empty', () => {
    const output = formatSearchResults([], 'zelda', []);
    expect(output).toContain("No games found matching 'zelda'.");
  });

  it('displays result count header and table when results are non-empty', () => {
    const entries = [
      makeEntry(1, 'The Legend of Zelda TOTK', 'SourceA'),
      makeEntry(2, 'Zelda Links Awakening', 'SourceB'),
    ];
    const output = formatSearchResults(entries, 'zelda', []);
    expect(output).toContain("Found 2 result(s) for 'zelda':");
    expect(output).toContain('The Legend of Zelda TOTK');
    expect(output).toContain('Zelda Links Awakening');
    expect(output).toContain('SourceA');
    expect(output).toContain('SourceB');
  });

  it('appends errors section when errors array is non-empty', () => {
    const entries = [makeEntry(1, 'Zelda TOTK', 'SourceA')];
    const errors = ['Failed to fetch SourceX', 'Timeout on SourceY'];
    const output = formatSearchResults(entries, 'zelda', errors);
    expect(output).toContain("Found 1 result(s) for 'zelda':");
    expect(output).toContain('Errors:');
    expect(output).toContain('  - Failed to fetch SourceX');
    expect(output).toContain('  - Timeout on SourceY');
  });

  it('appends errors section even when results are empty', () => {
    const errors = ['Failed to fetch SourceX'];
    const output = formatSearchResults([], 'zelda', errors);
    expect(output).toContain("No games found matching 'zelda'.");
    expect(output).toContain('Errors:');
    expect(output).toContain('  - Failed to fetch SourceX');
  });
});
