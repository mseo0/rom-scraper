import { describe, it, expect } from 'vitest';
import { notUltraNXParser } from '../src/parsers/notUltraNX';

const catalogBaseUrl = 'https://not.ultranx.ru/en';
const detailPageUrl = 'https://not.ultranx.ru/en/game/0100974026B32000';

describe('notUltraNX: extractGameLinks', () => {
  it('extracts game links from catalog HTML with div.card[data-href] elements', () => {
    const html = `
      <html><body>
        <div class="card-container">
          <div class="card cursor-pointer" data-href="en/game/0100F2C0115B6000">
            <div class="card-content">
              <div class="card-title">The Legend of Zelda: TOTK</div>
            </div>
          </div>
          <div class="card cursor-pointer" data-href="en/game/0100000000010000">
            <div class="card-content">
              <div class="card-title">Super Mario Odyssey</div>
            </div>
          </div>
          <div class="card cursor-pointer" data-href="en/game/010093801237C000">
            <div class="card-content">
              <div class="card-title">Metroid Dread</div>
            </div>
          </div>
        </div>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({
      url: 'https://not.ultranx.ru/en/game/0100F2C0115B6000',
      title: 'The Legend of Zelda: TOTK',
    });
    expect(links[1]).toEqual({
      url: 'https://not.ultranx.ru/en/game/0100000000010000',
      title: 'Super Mario Odyssey',
    });
    expect(links[2]).toEqual({
      url: 'https://not.ultranx.ru/en/game/010093801237C000',
      title: 'Metroid Dread',
    });
  });

  it('resolves relative data-href to absolute URLs', () => {
    const html = `
      <html><body>
        <div class="card" data-href="en/game/0100F2C0115B6000">
          <div class="card-title">Zelda</div>
        </div>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://not.ultranx.ru/en/game/0100F2C0115B6000');
    expect(links[0].url).toMatch(/^https?:\/\//);
  });

  it('returns empty array for empty HTML', () => {
    expect(notUltraNXParser.extractGameLinks('', catalogBaseUrl)).toEqual([]);
  });

  it('returns empty array for HTML with no matching elements', () => {
    const html = `
      <html><body>
        <p>No cards here at all</p>
        <div>Just some text content</div>
      </body></html>
    `;
    expect(notUltraNXParser.extractGameLinks(html, catalogBaseUrl)).toEqual([]);
  });

  it('deduplicates cards with the same data-href', () => {
    const html = `
      <html><body>
        <div class="card" data-href="en/game/0100F2C0115B6000">
          <div class="card-title">Zelda</div>
        </div>
        <div class="card" data-href="en/game/0100F2C0115B6000">
          <div class="card-title">Zelda Again</div>
        </div>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
  });

  it('falls back to <a> tags with /game/ in href when no cards found', () => {
    const html = `
      <html><body>
        <a href="/en/game/zelda">Zelda</a>
        <a href="/en/other-page">Other</a>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://not.ultranx.ru/en/game/zelda');
  });

  it('skips cards with empty data-href', () => {
    const html = `
      <html><body>
        <div class="card" data-href="">
          <div class="card-title">Empty</div>
        </div>
        <div class="card" data-href="en/game/abc">
          <div class="card-title">Valid</div>
        </div>
      </body></html>
    `;
    const links = notUltraNXParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe('Valid');
  });
});

describe('notUltraNX: extractDownloadLinks', () => {
  it('extracts game name from h1 and download URLs from .download-buttons', () => {
    const html = `
      <html><body>
        <h1>The Legend of Zelda: Tears of the Kingdom</h1>
        <div class="download-buttons">
          <a href="https://api.ultranx.ru/games/download/0100F2C0115B6000/base">Download Base</a>
          <a href="https://api.ultranx.ru/games/download/0100F2C0115B6000/update">Download Update</a>
          <a href="https://api.ultranx.ru/games/download/0100F2C0115B6000/full">Download everything</a>
        </div>
      </body></html>
    `;
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('The Legend of Zelda: Tears of the Kingdom');
    expect(result.urls).toHaveLength(3);
    expect(result.urls).toContain('https://api.ultranx.ru/games/download/0100F2C0115B6000/base');
    expect(result.urls).toContain('https://api.ultranx.ru/games/download/0100F2C0115B6000/update');
    expect(result.urls).toContain('https://api.ultranx.ru/games/download/0100F2C0115B6000/full');
  });

  it('falls back to title tag when no h1 is present', () => {
    const html = `
      <html>
        <head><title>notUltraNX - Super Mario Odyssey</title></head>
        <body>
          <div class="download-buttons">
            <a href="https://api.ultranx.ru/games/download/abc/base">Download</a>
          </div>
        </body>
      </html>
    `;
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('Super Mario Odyssey');
  });

  it('returns empty gameName and empty urls for empty HTML', () => {
    const result = notUltraNXParser.extractDownloadLinks('', detailPageUrl);
    expect(result.gameName).toBe('');
    expect(result.urls).toEqual([]);
  });

  it('falls back to external links when no .download-buttons found', () => {
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

  it('deduplicates download URLs', () => {
    const html = `
      <html><body>
        <h1>Zelda</h1>
        <div class="download-buttons">
          <a href="https://api.ultranx.ru/games/download/abc/base">Link 1</a>
          <a href="https://api.ultranx.ru/games/download/abc/base">Link 2</a>
        </div>
      </body></html>
    `;
    const result = notUltraNXParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.urls).toHaveLength(1);
  });
});
