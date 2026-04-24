import { describe, it, expect } from 'vitest';
import { notUltraNXParser } from '../src/parsers/notUltraNX';

const catalogBaseUrl = 'https://not.ultranx.ru/en';
const detailPageUrl = 'https://not.ultranx.ru/en/game/123';

describe('notUltraNX: extractGameLinks', () => {
  it('extracts game links from catalog HTML with article elements', () => {
    const html = `
      <html><body>
        <article>
          <a href="/en/game/zelda">The Legend of Zelda: TOTK</a>
        </article>
        <article>
          <a href="/en/game/mario">Super Mario Odyssey</a>
        </article>
        <article>
          <a href="/en/game/metroid">Metroid Dread</a>
        </article>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({
      url: 'https://not.ultranx.ru/en/game/zelda',
      title: 'The Legend of Zelda: TOTK',
    });
    expect(links[1]).toEqual({
      url: 'https://not.ultranx.ru/en/game/mario',
      title: 'Super Mario Odyssey',
    });
    expect(links[2]).toEqual({
      url: 'https://not.ultranx.ru/en/game/metroid',
      title: 'Metroid Dread',
    });
  });

  it('resolves relative URLs to absolute URLs', () => {
    const html = `
      <html><body>
        <article>
          <a href="/en/game/zelda">Zelda</a>
        </article>
        <article>
          <a href="game/mario">Mario</a>
        </article>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link.url).toMatch(/^https?:\/\//);
    }
    expect(links[0].url).toBe('https://not.ultranx.ru/en/game/zelda');
  });

  it('returns empty array for empty HTML', () => {
    expect(notUltraNXParser.extractGameLinks('', catalogBaseUrl)).toEqual([]);
  });

  it('returns empty array for HTML with no matching links', () => {
    const html = `
      <html><body>
        <p>No links here at all</p>
        <div>Just some text content</div>
      </body></html>
    `;
    expect(notUltraNXParser.extractGameLinks(html, catalogBaseUrl)).toEqual([]);
  });

  it('filters out external domain links', () => {
    const html = `
      <html><body>
        <article>
          <a href="https://not.ultranx.ru/en/game/zelda">Zelda</a>
          <a href="https://other-site.com/game">External Game</a>
        </article>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://not.ultranx.ru/en/game/zelda');
  });

  it('deduplicates links with the same URL', () => {
    const html = `
      <html><body>
        <article>
          <a href="/en/game/zelda">Zelda</a>
        </article>
        <article>
          <a href="/en/game/zelda">Zelda Again</a>
        </article>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://not.ultranx.ru/en/game/zelda');
  });

  it('skips anchor-only and javascript: links', () => {
    const html = `
      <html><body>
        <article>
          <a href="#">Top</a>
          <a href="javascript:void(0)">Click</a>
          <a href="/en/game/zelda">Zelda</a>
        </article>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://not.ultranx.ru/en/game/zelda');
  });

  it('returns empty array for invalid base URL', () => {
    const html = `<article><a href="/game/zelda">Zelda</a></article>`;
    expect(notUltraNXParser.extractGameLinks(html, 'not-a-url')).toEqual([]);
  });
});

describe('notUltraNX: extractDownloadLinks', () => {
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
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
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
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('Super Mario Odyssey - Download');
    expect(result.urls).toContain('https://mediafire.com/file/abc');
  });

  it('returns empty gameName and empty urls for empty HTML', () => {
    const result = notUltraNXParser.extractDownloadLinks('', detailPageUrl);
    expect(result.gameName).toBe('');
    expect(result.urls).toEqual([]);
  });

  it('returns empty urls when page has no external links', () => {
    const html = `
      <html><body>
        <h1>Metroid Dread</h1>
        <a href="/en/other-page">Internal Link</a>
        <a href="https://not.ultranx.ru/en/another">Another Internal</a>
      </body></html>
    `;
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('Metroid Dread');
    expect(result.urls).toEqual([]);
  });

  it('deduplicates external URLs', () => {
    const html = `
      <html><body>
        <h1>Zelda</h1>
        <a href="https://mega.nz/file/abc">Link 1</a>
        <a href="https://mega.nz/file/abc">Link 2</a>
      </body></html>
    `;
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toBe('https://mega.nz/file/abc');
  });

  it('excludes same-domain links and includes only external links', () => {
    const html = `
      <html><body>
        <h1>Game Title</h1>
        <a href="https://not.ultranx.ru/en/other">Same domain</a>
        <a href="https://mega.nz/file/abc">Mega</a>
        <a href="https://drive.google.com/file/d/xyz">Google Drive</a>
      </body></html>
    `;
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain('https://mega.nz/file/abc');
    expect(result.urls).toContain('https://drive.google.com/file/d/xyz');
  });
});
