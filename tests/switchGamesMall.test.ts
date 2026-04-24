import { describe, it, expect } from 'vitest';
import { switchGamesMallParser } from '../src/parsers/switchGamesMall';

const catalogBaseUrl = 'https://switchgamesmall.icu/';
const detailPageUrl = 'https://switchgamesmall.icu/game/zelda-totk/';

describe('switchGamesMall: extractGameLinks', () => {
  it('extracts game links from catalog with game card links', () => {
    const html = `
      <html><body>
        <div class="catalog">
          <div class="game-card">
            <a href="/game/zelda-totk/">The Legend of Zelda: TOTK</a>
          </div>
          <div class="game-card">
            <a href="/game/mario-odyssey/">Super Mario Odyssey</a>
          </div>
          <div class="game-card">
            <a href="/game/metroid-dread/">Metroid Dread</a>
          </div>
        </div>
      </body></html>
    `;
    const links = switchGamesMallParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({
      url: 'https://switchgamesmall.icu/game/zelda-totk/',
      title: 'The Legend of Zelda: TOTK',
    });
    expect(links[1]).toEqual({
      url: 'https://switchgamesmall.icu/game/mario-odyssey/',
      title: 'Super Mario Odyssey',
    });
    expect(links[2]).toEqual({
      url: 'https://switchgamesmall.icu/game/metroid-dread/',
      title: 'Metroid Dread',
    });
  });

  it('returns empty array for empty HTML', () => {
    expect(switchGamesMallParser.extractGameLinks('', catalogBaseUrl)).toEqual([]);
  });

  it('deduplicates links with the same URL', () => {
    const html = `
      <html><body>
        <div class="grid">
          <div class="game-card">
            <a href="/game/zelda-totk/">Zelda TOTK</a>
          </div>
          <div class="game-card">
            <a href="/game/zelda-totk/">Zelda TOTK Again</a>
          </div>
        </div>
      </body></html>
    `;
    const links = switchGamesMallParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://switchgamesmall.icu/game/zelda-totk/');
  });

  it('resolves relative URLs to absolute', () => {
    const html = `
      <html><body>
        <div class="grid">
          <div class="game-card">
            <a href="/game/zelda-totk/">Zelda TOTK</a>
          </div>
          <div class="game-card">
            <a href="game/mario-odyssey/">Mario Odyssey</a>
          </div>
        </div>
      </body></html>
    `;
    const links = switchGamesMallParser.extractGameLinks(html, catalogBaseUrl);
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link.url).toMatch(/^https?:\/\//);
    }
    expect(links[0].url).toBe('https://switchgamesmall.icu/game/zelda-totk/');
  });

  it('filters out external domain links', () => {
    const html = `
      <html><body>
        <div class="grid">
          <div class="game-card">
            <a href="https://switchgamesmall.icu/game/zelda-totk/">Zelda TOTK</a>
          </div>
          <div class="game-card">
            <a href="https://other-site.com/game/mario/">External Mario</a>
          </div>
        </div>
      </body></html>
    `;
    const links = switchGamesMallParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://switchgamesmall.icu/game/zelda-totk/');
  });
});

describe('switchGamesMall: extractDownloadLinks', () => {
  it('extracts game name from h1 and external download URLs', () => {
    const html = `
      <html><body>
        <h1>The Legend of Zelda: Tears of the Kingdom</h1>
        <div class="downloads">
          <a href="https://mega.nz/file/abc123">Download from Mega</a>
          <a href="https://1fichier.com/?xyz789">Download from 1fichier</a>
        </div>
      </body></html>
    `;
    const result = switchGamesMallParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('The Legend of Zelda: Tears of the Kingdom');
    expect(result.urls).toContain('https://mega.nz/file/abc123');
    expect(result.urls).toContain('https://1fichier.com/?xyz789');
  });

  it('falls back to title tag when no h1 is present', () => {
    const html = `
      <html>
        <head><title>Super Mario Odyssey - Download</title></head>
        <body>
          <a href="https://mediafire.com/file/abc">Download</a>
        </body>
      </html>
    `;
    const result = switchGamesMallParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('Super Mario Odyssey - Download');
    expect(result.urls).toContain('https://mediafire.com/file/abc');
  });

  it('returns empty gameName and empty urls for empty HTML', () => {
    const result = switchGamesMallParser.extractDownloadLinks('', detailPageUrl);
    expect(result.gameName).toBe('');
    expect(result.urls).toEqual([]);
  });

  it('only returns external links, not same-domain links', () => {
    const html = `
      <html><body>
        <h1>Game Title</h1>
        <a href="https://switchgamesmall.icu/other-page/">Internal Link</a>
        <a href="https://switchgamesmall.icu/category/switch/">Category</a>
        <a href="https://mega.nz/file/abc">Mega Download</a>
        <a href="https://drive.google.com/file/d/xyz">Google Drive</a>
      </body></html>
    `;
    const result = switchGamesMallParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain('https://mega.nz/file/abc');
    expect(result.urls).toContain('https://drive.google.com/file/d/xyz');
  });
});
