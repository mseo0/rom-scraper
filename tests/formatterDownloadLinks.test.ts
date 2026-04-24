import { describe, it, expect } from 'vitest';
import { formatResults, formatSearchResults } from '../src/formatter';
import { GameEntry } from '../src/types';
import { DownloadLink } from '../src/fileHosts';

function makeEntry(overrides: Partial<GameEntry> = {}): GameEntry {
  return {
    index: 1,
    gameName: 'Test Game',
    downloadUrl: 'https://api.ultranx.ru/games/download/ABC/base',
    sourceName: 'notUltraNX',
    sourceUrl: 'https://not.ultranx.ru/en',
    ...overrides,
  };
}

describe('formatResults with downloadLinks', () => {
  it('displays all download links with pack labels when downloadLinks is non-empty', () => {
    const downloadLinks: DownloadLink[] = [
      { url: 'https://api.ultranx.ru/games/download/ABC/base', hostName: 'Base Game' },
      { url: 'https://api.ultranx.ru/games/download/ABC/update', hostName: 'Update' },
      { url: 'https://api.ultranx.ru/games/download/ABC/full', hostName: 'Full Pack' },
    ];
    const entry = makeEntry({ downloadLinks, downloadUrl: downloadLinks[0].url });
    const output = formatResults([entry], []);

    expect(output).toContain('Base Game');
    expect(output).toContain('Update');
    expect(output).toContain('Full Pack');
    expect(output).toContain('api.ultranx.ru/games/download/ABC/base');
  });

  it('falls back to downloadUrl when downloadLinks is empty', () => {
    const entry = makeEntry({ downloadLinks: [], downloadUrl: 'https://example.com/fallback.nsp' });
    const output = formatResults([entry], []);
    expect(output).toContain('example.com/fallback.nsp');
  });

  it('falls back to downloadUrl when downloadLinks is undefined', () => {
    const entry = makeEntry({ downloadLinks: undefined, downloadUrl: 'https://example.com/fallback.nsp' });
    const output = formatResults([entry], []);
    expect(output).toContain('example.com/fallback.nsp');
  });

  it('handles mixed entries: one with downloadLinks, one without', () => {
    const withLinks = makeEntry({
      index: 1,
      gameName: 'Game With Links',
      downloadLinks: [
        { url: 'https://api.ultranx.ru/games/download/ABC/base', hostName: 'Base Game' },
      ],
      downloadUrl: 'https://api.ultranx.ru/games/download/ABC/base',
      sourceName: 'notUltraNX',
    });
    const withoutLinks = makeEntry({
      index: 2,
      gameName: 'Game Without Links',
      downloadLinks: undefined,
      downloadUrl: 'https://example.com/plain.nsp',
      sourceName: 'OtherSource',
    });
    const output = formatResults([withLinks, withoutLinks], []);
    expect(output).toContain('Base Game');
    expect(output).toContain('example.com/plain.nsp');
  });
});

describe('formatSearchResults with downloadLinks', () => {
  it('displays pack labels in search results when downloadLinks is non-empty', () => {
    const downloadLinks: DownloadLink[] = [
      { url: 'https://api.ultranx.ru/games/download/ABC/base', hostName: 'Base Game' },
      { url: 'https://api.ultranx.ru/games/download/ABC/full', hostName: 'Full Pack' },
    ];
    const entry = makeEntry({
      gameName: 'Zelda TOTK',
      downloadLinks,
      downloadUrl: downloadLinks[0].url,
    });
    const output = formatSearchResults([entry], 'zelda', []);
    expect(output).toContain('Base Game');
    expect(output).toContain('Full Pack');
  });
});
