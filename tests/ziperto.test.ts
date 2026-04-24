import { describe, it, expect } from 'vitest';
import { zipertoParser } from '../src/parsers/ziperto';

const catalogBaseUrl = 'https://www.ziperto.com/nintendo-switch-nsp/';
const detailPageUrl = 'https://www.ziperto.com/zelda-totk/';

describe('ziperto: extractGameLinks', () => {
  it('extracts game links from WordPress catalog with .entry-title a links', () => {
    const html = `
      <html><body>
        <div id="main">
          <article>
            <h2 class="entry-title">
              <a href="https://www.ziperto.com/zelda-totk/">The Legend of Zelda: TOTK</a>
            </h2>
          </article>
          <article>
            <h2 class="entry-title">
              <a href="https://www.ziperto.com/mario-odyssey/">Super Mario Odyssey</a>
            </h2>
          </article>
          <article>
            <h2 class="entry-title">
              <a href="https://www.ziperto.com/metroid-dread/">Metroid Dread</a>
            </h2>
          </article>
        </div>
      </body></html>
    `;
    const links = zipertoParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({
      url: 'https://www.ziperto.com/zelda-totk/',
      title: 'The Legend of Zelda: TOTK',
    });
    expect(links[1]).toEqual({
      url: 'https://www.ziperto.com/mario-odyssey/',
      title: 'Super Mario Odyssey',
    });
    expect(links[2]).toEqual({
      url: 'https://www.ziperto.com/metroid-dread/',
      title: 'Metroid Dread',
    });
  });

  it('returns empty array for empty HTML', () => {
    expect(zipertoParser.extractGameLinks('', catalogBaseUrl)).toEqual([]);
  });

  it('returns empty array when no matching links are found', () => {
    const html = `
      <html><body>
        <p>No games here, just text.</p>
      </body></html>
    `;
    expect(zipertoParser.extractGameLinks(html, catalogBaseUrl)).toEqual([]);
  });

  it('deduplicates links with the same URL', () => {
    const html = `
      <html><body>
        <article>
          <h2 class="entry-title">
            <a href="https://www.ziperto.com/zelda-totk/">Zelda TOTK</a>
          </h2>
        </article>
        <article>
          <h2 class="entry-title">
            <a href="https://www.ziperto.com/zelda-totk/">Zelda TOTK Again</a>
          </h2>
        </article>
      </body></html>
    `;
    const links = zipertoParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://www.ziperto.com/zelda-totk/');
  });

  it('resolves relative URLs to absolute', () => {
    const html = `
      <html><body>
        <article>
          <h2 class="entry-title">
            <a href="/zelda-totk/">Zelda TOTK</a>
          </h2>
        </article>
        <article>
          <h2 class="entry-title">
            <a href="mario-odyssey/">Mario Odyssey</a>
          </h2>
        </article>
      </body></html>
    `;
    const links = zipertoParser.extractGameLinks(html, catalogBaseUrl);
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link.url).toMatch(/^https?:\/\//);
    }
    expect(links[0].url).toBe('https://www.ziperto.com/zelda-totk/');
  });

  it('skips links inside sidebar and widget areas', () => {
    const html = `
      <html><body>
        <div id="main">
          <article>
            <h2 class="entry-title">
              <a href="https://www.ziperto.com/zelda-totk/">Zelda TOTK</a>
            </h2>
          </article>
        </div>
        <div id="sidebar">
          <div class="widget">
            <a href="https://www.ziperto.com/popular-game/">Popular Game</a>
          </div>
        </div>
        <div class="widget-area">
          <a href="https://www.ziperto.com/trending-game/">Trending Game</a>
        </div>
      </body></html>
    `;
    const links = zipertoParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://www.ziperto.com/zelda-totk/');
  });

  it('skips WordPress utility paths like /category/, /tag/, /page/', () => {
    const html = `
      <html><body>
        <article>
          <a href="https://www.ziperto.com/zelda-totk/">Zelda TOTK</a>
          <a href="https://www.ziperto.com/category/switch/">Switch Category</a>
          <a href="https://www.ziperto.com/tag/rpg/">RPG Tag</a>
          <a href="https://www.ziperto.com/page/2/">Page 2</a>
          <a href="https://www.ziperto.com/author/admin/">Admin</a>
        </article>
      </body></html>
    `;
    const links = zipertoParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://www.ziperto.com/zelda-totk/');
  });
});

describe('ziperto: extractDownloadLinks', () => {
  it('extracts game name from h1 and external download links in .entry-content', () => {
    const html = `
      <html><body>
        <h1 class="entry-title">The Legend of Zelda: Tears of the Kingdom</h1>
        <div class="entry-content">
          <p>Download links below:</p>
          <a href="https://mega.nz/file/abc123">Download from Mega</a>
          <a href="https://1fichier.com/?xyz789">Download from 1fichier</a>
          <a href="https://drive.google.com/file/d/abc">Google Drive</a>
        </div>
      </body></html>
    `;
    const result = zipertoParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('The Legend of Zelda: Tears of the Kingdom');
    expect(result.urls).toContain('https://mega.nz/file/abc123');
    expect(result.urls).toContain('https://1fichier.com/?xyz789');
    expect(result.urls).toContain('https://drive.google.com/file/d/abc');
    expect(result.urls).toHaveLength(3);
  });

  it('returns empty urls when page has no external download links', () => {
    const html = `
      <html><body>
        <h1 class="entry-title">Some Game</h1>
        <div class="entry-content">
          <p>No download links here.</p>
          <a href="https://www.ziperto.com/other-game/">Another game</a>
          <a href="https://www.ziperto.com/category/switch/">Category</a>
        </div>
      </body></html>
    `;
    const result = zipertoParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('Some Game');
    expect(result.urls).toEqual([]);
  });

  it('falls back to title tag when no h1 is present and strips WordPress suffix', () => {
    const html = `
      <html>
        <head><title>Super Mario Odyssey – Ziperto</title></head>
        <body>
          <div class="entry-content">
            <a href="https://mediafire.com/file/abc">Download</a>
          </div>
        </body>
      </html>
    `;
    const result = zipertoParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('Super Mario Odyssey');
    expect(result.urls).toContain('https://mediafire.com/file/abc');
  });

  it('returns empty gameName and empty urls for empty HTML', () => {
    const result = zipertoParser.extractDownloadLinks('', detailPageUrl);
    expect(result.gameName).toBe('');
    expect(result.urls).toEqual([]);
  });

  it('returns empty gameName when no h1 or title is present', () => {
    const html = `
      <html>
        <head></head>
        <body>
          <div class="entry-content">
            <a href="https://mega.nz/file/abc123">Download</a>
          </div>
        </body>
      </html>
    `;
    const result = zipertoParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('');
    expect(result.urls).toContain('https://mega.nz/file/abc123');
  });
});
