import { describe, it, expect } from 'vitest';
import {
  matchFileHost,
  isIntermediary,
  filterDownloadLinks,
  registerFileHost,
  registerIntermediary,
} from '../src/fileHosts';

describe('matchFileHost', () => {
  it('matches exact file host domains', () => {
    const result = matchFileHost('https://mega.nz/file/abc123');
    expect(result).toEqual({ url: 'https://mega.nz/file/abc123', hostName: 'Mega' });
  });

  it('matches subdomain of registered domain (nz.mega.nz)', () => {
    const result = matchFileHost('https://nz.mega.nz/file/abc123');
    expect(result).toEqual({ url: 'https://nz.mega.nz/file/abc123', hostName: 'Mega' });
  });

  it('matches drive.google.com', () => {
    const result = matchFileHost('https://drive.google.com/file/d/abc/view');
    expect(result).toEqual({ url: 'https://drive.google.com/file/d/abc/view', hostName: 'Google Drive' });
  });

  it('matches mediafire.com', () => {
    const result = matchFileHost('https://www.mediafire.com/file/abc');
    expect(result).toEqual({ url: 'https://www.mediafire.com/file/abc', hostName: 'MediaFire' });
  });

  it('matches 1fichier.com', () => {
    const result = matchFileHost('https://1fichier.com/?abc123');
    expect(result).toEqual({ url: 'https://1fichier.com/?abc123', hostName: '1fichier' });
  });

  it('returns null for unrecognized domains', () => {
    expect(matchFileHost('https://example.com/file')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(matchFileHost('not-a-url')).toBeNull();
  });

  it('does not match partial domain names (notmega.nz)', () => {
    expect(matchFileHost('https://notmega.nz/file')).toBeNull();
  });

  it('matches URLs with .nsp extension as Direct Download', () => {
    const result = matchFileHost('https://example.com/game.nsp');
    expect(result).toEqual({ url: 'https://example.com/game.nsp', hostName: 'Direct Download' });
  });

  it('matches URLs with .xci extension as Direct Download', () => {
    const result = matchFileHost('https://example.com/game.xci');
    expect(result).toEqual({ url: 'https://example.com/game.xci', hostName: 'Direct Download' });
  });

  it('matches URLs with .nsz extension as Direct Download', () => {
    const result = matchFileHost('https://example.com/game.nsz');
    expect(result).toEqual({ url: 'https://example.com/game.nsz', hostName: 'Direct Download' });
  });

  it('prefers file host match over ROM extension', () => {
    const result = matchFileHost('https://mega.nz/file/game.nsp');
    expect(result).toEqual({ url: 'https://mega.nz/file/game.nsp', hostName: 'Mega' });
  });
});

describe('isIntermediary', () => {
  it('identifies bit.ly as intermediary', () => {
    expect(isIntermediary('https://bit.ly/abc123')).toBe(true);
  });

  it('identifies adf.ly as intermediary', () => {
    expect(isIntermediary('https://adf.ly/abc123')).toBe(true);
  });

  it('identifies ouo.io as intermediary', () => {
    expect(isIntermediary('https://ouo.io/abc123')).toBe(true);
  });

  it('identifies linkvertise.com as intermediary', () => {
    expect(isIntermediary('https://linkvertise.com/abc123')).toBe(true);
  });

  it('identifies subdomain of intermediary', () => {
    expect(isIntermediary('https://sub.bit.ly/abc123')).toBe(true);
  });

  it('returns false for non-intermediary domains', () => {
    expect(isIntermediary('https://mega.nz/file/abc')).toBe(false);
  });

  it('returns false for malformed URLs', () => {
    expect(isIntermediary('not-a-url')).toBe(false);
  });
});

describe('filterDownloadLinks', () => {
  it('returns only file host URLs from a mixed list', () => {
    const urls = [
      'https://mega.nz/file/abc123',
      'https://bit.ly/short',
      'https://example.com/page',
      'https://1fichier.com/?xyz',
    ];
    const result = filterDownloadLinks(urls);
    expect(result).toEqual([
      { url: 'https://mega.nz/file/abc123', hostName: 'Mega' },
      { url: 'https://1fichier.com/?xyz', hostName: '1fichier' },
    ]);
  });

  it('excludes intermediary URLs even if they somehow match a host', () => {
    const urls = [
      'https://bit.ly/mega-link',
      'https://adf.ly/redirect',
    ];
    expect(filterDownloadLinks(urls)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(filterDownloadLinks([])).toEqual([]);
  });

  it('returns empty array when no URLs match', () => {
    const urls = ['https://example.com/page', 'https://unknown.org/file'];
    expect(filterDownloadLinks(urls)).toEqual([]);
  });

  it('includes ROM extension URLs as Direct Download', () => {
    const urls = [
      'https://somehost.com/game.nsp',
      'https://example.com/page',
    ];
    const result = filterDownloadLinks(urls);
    expect(result).toEqual([
      { url: 'https://somehost.com/game.nsp', hostName: 'Direct Download' },
    ]);
  });

  it('handles malformed URLs gracefully', () => {
    const urls = ['not-a-url', 'https://mega.nz/file/abc'];
    const result = filterDownloadLinks(urls);
    expect(result).toEqual([
      { url: 'https://mega.nz/file/abc', hostName: 'Mega' },
    ]);
  });
});

describe('registerFileHost', () => {
  it('adds a new domain that is subsequently recognized', () => {
    expect(matchFileHost('https://newhost.example.com/file')).toBeNull();
    registerFileHost('newhost.example.com', 'NewHost');
    const result = matchFileHost('https://newhost.example.com/file');
    expect(result).toEqual({ url: 'https://newhost.example.com/file', hostName: 'NewHost' });
  });
});

describe('registerIntermediary', () => {
  it('adds a new domain that is subsequently filtered', () => {
    expect(isIntermediary('https://newgate.example.com/link')).toBe(false);
    registerIntermediary('newgate.example.com');
    expect(isIntermediary('https://newgate.example.com/link')).toBe(true);
  });

  it('new intermediary is excluded by filterDownloadLinks', () => {
    registerIntermediary('adgate.test.com');
    const urls = [
      'https://mega.nz/file/abc',
      'https://adgate.test.com/redirect',
    ];
    const result = filterDownloadLinks(urls);
    expect(result).toEqual([
      { url: 'https://mega.nz/file/abc', hostName: 'Mega' },
    ]);
  });
});
