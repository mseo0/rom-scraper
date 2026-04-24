import { describe, it, expect } from 'vitest';
import { formatResults, formatSearchResults } from '../src/formatter';
import { GameEntry } from '../src/types';
import { DownloadLink } from '../src/fileHosts';

function makeEntry(overrides: Partial<GameEntry> = {}): GameEntry {
  return {
    index: 1,
    gameName: 'Test Game',
    downloadUrl: 'https://example.com/test.nsp',
    sourceName: 'TestSource',
    sourceUrl: 'https://example.com',
    ...overrides,
  };
}

describe('formatResults with downloadLinks', () => {
  it('displays all download links with host names when downloadLinks is non-empty', () => {
    const downloadLinks: DownloadLink[] = [
      { url: 'https://mega.nz/file/abc123', hostName: 'Mega' },
      { url: 'https://mediafire.com/file/xyz', hostName: 'MediaFire' },
      { url: 'https://1fichier.com/?abcdef', hostName: '1fichier' },
    ];
    const entry = makeEntry({ downloadLinks, downloadUrl: downloadLinks[0].url });
    const output = formatResults([entry], []);

    expect(output).toContain('[Mega]');
    expect(output).toContain('mega.nz/file/abc123');
    expect(output).toContain('[MediaFire]');
    expect(output).toContain('mediafire.com/file/xyz');
    expect(output).toContain('[1fichier]');
    expect(output).toContain('1fichier.com/?abcdef');
  });

  it('falls back to downloadUrl when downloadLinks is empty', () => {
    const entry = makeEntry({ downloadLinks: [], downloadUrl: 'https://example.com/fallback.nsp' });
    const output = formatResults([entry], []);

    expect(output).toContain('example.com/fallback.nsp');
    // No host name labels should appear in the download column
    expect(output).not.toMatch(/\[Mega\]/);
    expect(output).not.toMatch(/\[MediaFire\]/);
  });

  it('falls back to downloadUrl when downloadLinks is undefined', () => {
    const entry = makeEntry({ downloadLinks: undefined, downloadUrl: 'https://example.com/fallback.nsp' });
    const output = formatResults([entry], []);

    expect(output).toContain('example.com/fallback.nsp');
    // No host name labels should appear in the download column
    expect(output).not.toMatch(/\[Mega\]/);
    expect(output).not.toMatch(/\[MediaFire\]/);
  });

  it('handles mixed entries: one with downloadLinks, one without', () => {
    const withLinks = makeEntry({
      index: 1,
      gameName: 'Game With Links',
      downloadLinks: [
        { url: 'https://mega.nz/file/abc', hostName: 'Mega' },
        { url: 'https://gofile.io/d/xyz', hostName: 'Gofile' },
      ],
      downloadUrl: 'https://mega.nz/file/abc',
      sourceName: 'SourceA',
    });
    const withoutLinks = makeEntry({
      index: 2,
      gameName: 'Game Without Links',
      downloadLinks: undefined,
      downloadUrl: 'https://example.com/plain.nsp',
      sourceName: 'SourceB',
    });
    const output = formatResults([withLinks, withoutLinks], []);

    // Entry with downloadLinks shows host names
    expect(output).toContain('[Mega]');
    expect(output).toContain('[Gofile]');
    // Entry without downloadLinks shows plain URL
    expect(output).toContain('example.com/plain.nsp');
  });
});

describe('formatSearchResults with downloadLinks', () => {
  it('displays host names in search results when downloadLinks is non-empty', () => {
    const downloadLinks: DownloadLink[] = [
      { url: 'https://mega.nz/file/search123', hostName: 'Mega' },
      { url: 'https://pixeldrain.com/u/abc', hostName: 'Pixeldrain' },
    ];
    const entry = makeEntry({
      gameName: 'Zelda TOTK',
      downloadLinks,
      downloadUrl: downloadLinks[0].url,
    });
    const output = formatSearchResults([entry], 'zelda', []);

    expect(output).toContain('[Mega]');
    expect(output).toContain('mega.nz/file/search123');
    expect(output).toContain('[Pixeldrain]');
    expect(output).toContain('pixeldrain.com/u/abc');
  });
});
