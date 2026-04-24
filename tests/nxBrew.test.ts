import { describe, it, expect } from 'vitest';
import { nxBrewParser } from '../src/parsers/nxBrew';

const catalogBaseUrl = 'https://nxbrew.net/';
const detailPageUrl = 'https://nxbrew.net/zelda-totk/';

describe('nxBrew: extractGameLinks', () => {
  it('extracts game links from WordPress blog catalog with .entry-title a links', () => {
    const html = `
      <html><body>
        <div id="main">
          <article>
            <h2 class="entry-title">
              <a href="https://nxbrew.net/zelda-totk/">The Legend of Zelda: TOTK</a>
            </h2>
          </article>
          <article>
            <h2 class="entry-title">
              <a href="https://nxbrew.net/mario-odyssey/">Super Mario Odyssey</a>
            </h2>
          </article>
          <article>
            <h2 class="entry-title">
              <a href="https://nxbrew.net/metroid-dread/">Metroid Dread</a>
            </h2>
          </article>
        </div>
      </body></html>
    `;
    const links = nxBrewParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({
      url: 'https://nxbrew.net/zelda-totk/',
      title: 'The Legend of Zelda: TOTK',
    });
    expect(links[1]).toEqual({
      url: 'https://nxbrew.net/mario-odyssey/',
      title: 'Super Mario Odyssey',
    });
    expect(links[2]).toEqual({
      url: 'https://nxbrew.net/metroid-dread/',
      title: 'Metroid Dread',
    });
  });

  it('extracts game links from catalog with article/h2 links', () => {
    const html = `
      <html><body>
        <div id="content">
          <article>
            <h2><a href="https://nxbrew.net/splatoon-3/">Splatoon 3</a></h2>
          </article>
          <article>
            <h2><a href="https://nxbrew.net/pikmin-4/">Pikmin 4</a></h2>
          </article>
        </div>
      </body></html>
    `;
    const links = nxBrewParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({
      url: 'https://nxbrew.net/splatoon-3/',
      title: 'Splatoon 3',
    });
    expect(links[1]).toEqual({
      url: 'https://nxbrew.net/pikmin-4/',
      title: 'Pikmin 4',
    });
  });

  it('returns empty array for empty HTML', () => {
    expect(nxBrewParser.extractGameLinks('', catalogBaseUrl)).toEqual([]);
  });

  it('skips links inside sidebar and widget areas', () => {
    const html = `
      <html><body>
        <div id="main">
          <article>
            <h2 class="entry-title">
              <a href="https://nxbrew.net/zelda-totk/">Zelda TOTK</a>
            </h2>
          </article>
        </div>
        <div id="sidebar">
          <div class="widget">
            <a href="https://nxbrew.net/popular-game/">Popular Game</a>
          </div>
        </div>
        <div class="widget-area">
          <a href="https://nxbrew.net/trending-game/">Trending Game</a>
        </div>
      </body></html>
    `;
    const links = nxBrewParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://nxbrew.net/zelda-totk/');
  });

  it('skips WordPress utility paths like /category/, /tag/, /page/', () => {
    const html = `
      <html><body>
        <article>
          <a href="https://nxbrew.net/zelda-totk/">Zelda TOTK</a>
          <a href="https://nxbrew.net/category/switch/">Switch Category</a>
          <a href="https://nxbrew.net/tag/rpg/">RPG Tag</a>
          <a href="https://nxbrew.net/page/2/">Page 2</a>
          <a href="https://nxbrew.net/author/admin/">Admin</a>
        </article>
      </body></html>
    `;
    const links = nxBrewParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://nxbrew.net/zelda-totk/');
  });

  it('deduplicates links with the same URL', () => {
    const html = `
      <html><body>
        <article>
          <h2 class="entry-title">
            <a href="https://nxbrew.net/zelda-totk/">Zelda TOTK</a>
          </h2>
        </article>
        <article>
          <h2 class="entry-title">
            <a href="https://nxbrew.net/zelda-totk/">Zelda TOTK Again</a>
          </h2>
        </article>
      </body></html>
    `;
    const links = nxBrewParser.extractGameLinks(html, catalogBaseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://nxbrew.net/zelda-totk/');
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
    const links = nxBrewParser.extractGameLinks(html, catalogBaseUrl);
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link.url).toMatch(/^https?:\/\//);
    }
    expect(links[0].url).toBe('https://nxbrew.net/zelda-totk/');
  });
});

describe('nxBrew: extractDownloadLinks', () => {
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
    const result = nxBrewParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('The Legend of Zelda: Tears of the Kingdom');
    expect(result.urls).toContain('https://mega.nz/file/abc123');
    expect(result.urls).toContain('https://1fichier.com/?xyz789');
    expect(result.urls).toContain('https://drive.google.com/file/d/abc');
    expect(result.urls).toHaveLength(3);
  });

  it('avoids fake download buttons in sidebar/widget areas', () => {
    const html = `
      <html><body>
        <h1>Zelda TOTK</h1>
        <div class="entry-content">
          <a href="https://mega.nz/file/real123">Real Download</a>
        </div>
        <div class="sidebar">
          <a href="https://fakehost.com/fake-download">Fake Download</a>
        </div>
        <div class="widget">
          <a href="https://adsite.com/fake-button">Download Now!</a>
        </div>
        <div class="widget-area">
          <a href="https://scam.com/download">Get it here</a>
        </div>
      </body></html>
    `;
    const result = nxBrewParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toBe('https://mega.nz/file/real123');
  });

  it('avoids links with fake/ad-related classes', () => {
    const html = `
      <html><body>
        <h1>Zelda TOTK</h1>
        <div class="entry-content">
          <a href="https://mega.nz/file/real123">Real Download</a>
          <a href="https://adsite.com/fake" class="fake-download-btn">Fake Button</a>
          <a href="https://adsite2.com/ad" class="adsbygoogle">Ad Link</a>
        </div>
      </body></html>
    `;
    const result = nxBrewParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toBe('https://mega.nz/file/real123');
  });

  it('falls back to title tag when no h1 is present', () => {
    const html = `
      <html>
        <head><title>Super Mario Odyssey – NXBrew</title></head>
        <body>
          <div class="entry-content">
            <a href="https://mediafire.com/file/abc">Download</a>
          </div>
        </body>
      </html>
    `;
    const result = nxBrewParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.gameName).toBe('Super Mario Odyssey');
    expect(result.urls).toContain('https://mediafire.com/file/abc');
  });

  it('returns empty gameName and empty urls for empty HTML', () => {
    const result = nxBrewParser.extractDownloadLinks('', detailPageUrl);
    expect(result.gameName).toBe('');
    expect(result.urls).toEqual([]);
  });

  it('only returns external links, not same-domain links', () => {
    const html = `
      <html><body>
        <h1>Game Title</h1>
        <div class="entry-content">
          <a href="https://nxbrew.net/other-game/">Internal Link</a>
          <a href="https://nxbrew.net/category/switch/">Category</a>
          <a href="https://mega.nz/file/abc">Mega Download</a>
          <a href="https://drive.google.com/file/d/xyz">Google Drive</a>
        </div>
      </body></html>
    `;
    const result = nxBrewParser.extractDownloadLinks(html, detailPageUrl);
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain('https://mega.nz/file/abc');
    expect(result.urls).toContain('https://drive.google.com/file/d/xyz');
  });
});
