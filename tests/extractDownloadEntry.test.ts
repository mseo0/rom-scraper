import { describe, it, expect } from 'vitest';
import { nspGameHubParser } from '../src/parsers/nspGameHub';
import { GameLink, Source } from '../src/types';

const gameLink: GameLink = { url: 'https://example.com/game/zelda', title: 'Zelda TOTK' };
const source: Source = { url: 'https://example.com', name: 'TestSource', requiresJs: false, deepLink: true };

describe('extractDownloadEntry', () => {
  it('should extract a direct .nsp link as downloadUrl', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <a href="https://cdn.example.com/zelda.nsp">Download NSP</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.downloadUrl).toBe('https://cdn.example.com/zelda.nsp');
  });

  it('should extract download button href when no .nsp link exists', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <a class="download-btn" href="https://example.com/download/zelda">Download</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.downloadUrl).toBe('https://example.com/download/zelda');
  });

  it('should fall back to a[href*="download"] selector', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <a href="https://example.com/download/zelda-file">Get File</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.downloadUrl).toBe('https://example.com/download/zelda-file');
  });

  it('should fall back to a.btn-download selector', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <a class="btn-download" href="https://example.com/get/zelda">Download</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.downloadUrl).toBe('https://example.com/get/zelda');
  });

  it('should fall back to a.btn selector', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <a class="btn" href="https://example.com/btn/zelda">Click</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.downloadUrl).toBe('https://example.com/btn/zelda');
  });

  it('should prefer .nsp link over download button', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <a class="download-btn" href="https://example.com/download/zelda">Download</a>
        <a href="https://cdn.example.com/zelda.nsp">NSP File</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.downloadUrl).toBe('https://cdn.example.com/zelda.nsp');
  });

  it('should return null when no download URL is found', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <p>No download links here</p>
        <a href="https://example.com/about">About</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).toBeNull();
  });

  it('should populate detailPageUrl with gameLink.url', () => {
    const html = `
      <html><head><title>Zelda Page</title></head><body>
        <a href="https://cdn.example.com/zelda.nsp">Download</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.detailPageUrl).toBe('https://example.com/game/zelda');
  });

  it('should use <title> tag text as game name', () => {
    const html = `
      <html><head><title>The Legend of Zelda</title></head><body>
        <a href="https://cdn.example.com/zelda.nsp">Download</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.gameName).toBe('The Legend of Zelda');
  });

  it('should use <h1> text when no <title> tag', () => {
    const html = `
      <html><head></head><body>
        <h1>Zelda Breath of the Wild</h1>
        <a href="https://cdn.example.com/zelda.nsp">Download</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.gameName).toBe('Zelda Breath of the Wild');
  });

  it('should fall back to gameLink.title when no title or h1', () => {
    const html = `
      <html><head></head><body>
        <a href="https://cdn.example.com/zelda.nsp">Download</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.gameName).toBe('Zelda TOTK');
  });

  it('should set sourceName and sourceUrl from the source parameter', () => {
    const html = `
      <html><head><title>Zelda</title></head><body>
        <a href="https://cdn.example.com/zelda.nsp">Download</a>
      </body></html>
    `;
    const entry = nspGameHubParser.extractDownloadEntry(html, gameLink, source);
    expect(entry).not.toBeNull();
    expect(entry!.sourceName).toBe('TestSource');
    expect(entry!.sourceUrl).toBe('https://example.com');
  });
});
