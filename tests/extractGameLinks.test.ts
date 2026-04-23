import { describe, it, expect } from 'vitest';
import { nspGameHubParser } from '../src/parsers/nspGameHub';

const baseUrl = 'https://example.com/games';

describe('extractGameLinks', () => {
  it('should return empty array for empty HTML', () => {
    expect(nspGameHubParser.extractGameLinks('', baseUrl)).toEqual([]);
  });

  it('should return empty array when HTML has no links', () => {
    const html = `
      <html><body>
        <p>No links here</p>
        <div>Just some text content</div>
      </body></html>
    `;
    expect(nspGameHubParser.extractGameLinks(html, baseUrl)).toEqual([]);
  });

  it('should return empty array when HTML has only external-domain links', () => {
    const html = `
      <html><body>
        <a href="https://other-site.com/game1">Game 1</a>
        <a href="https://another-domain.org/game2">Game 2</a>
      </body></html>
    `;
    expect(nspGameHubParser.extractGameLinks(html, baseUrl)).toEqual([]);
  });

  it('should resolve relative URLs to absolute same-domain URLs', () => {
    const html = `
      <html><body>
        <a href="/game/zelda">Zelda</a>
        <a href="mario">Mario</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ url: 'https://example.com/game/zelda', title: 'Zelda' });
    expect(links[1]).toEqual({ url: 'https://example.com/mario', title: 'Mario' });
  });

  it('should keep absolute same-domain links as-is', () => {
    const html = `
      <html><body>
        <a href="https://example.com/game/zelda">Zelda</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ url: 'https://example.com/game/zelda', title: 'Zelda' });
  });

  it('should handle a mix of relative, absolute same-domain, and external links', () => {
    const html = `
      <html><body>
        <a href="/game/zelda">Zelda</a>
        <a href="https://example.com/game/mario">Mario</a>
        <a href="https://other-site.com/game/kirby">Kirby</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links).toHaveLength(2);
    expect(links[0].url).toBe('https://example.com/game/zelda');
    expect(links[1].url).toBe('https://example.com/game/mario');
  });

  it('should deduplicate links with the same URL', () => {
    const html = `
      <html><body>
        <a href="https://example.com/game/zelda">Zelda</a>
        <a href="https://example.com/game/zelda">Zelda Again</a>
        <a href="/game/zelda">Zelda Relative</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://example.com/game/zelda');
  });

  it('should skip anchor-only links (#)', () => {
    const html = `
      <html><body>
        <a href="#">Top</a>
        <a href="https://example.com/game/zelda">Zelda</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://example.com/game/zelda');
  });

  it('should skip javascript: links', () => {
    const html = `
      <html><body>
        <a href="javascript:void(0)">Click me</a>
        <a href="javascript:alert('hi')">Alert</a>
        <a href="https://example.com/game/zelda">Zelda</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://example.com/game/zelda');
  });

  it('should use link text as title', () => {
    const html = `
      <html><body>
        <a href="/game/zelda">The Legend of Zelda</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links[0].title).toBe('The Legend of Zelda');
  });

  it('should set title to empty string when link text is empty', () => {
    const html = `
      <html><body>
        <a href="/game/zelda"></a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links[0].title).toBe('');
  });

  it('should return empty array for invalid base URL', () => {
    const html = `<a href="/game/zelda">Zelda</a>`;
    expect(nspGameHubParser.extractGameLinks(html, 'not-a-url')).toEqual([]);
  });

  it('should skip links with empty href', () => {
    const html = `
      <html><body>
        <a href="">Empty</a>
        <a href="https://example.com/game/zelda">Zelda</a>
      </body></html>
    `;
    const links = nspGameHubParser.extractGameLinks(html, baseUrl);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://example.com/game/zelda');
  });
});
