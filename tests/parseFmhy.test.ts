import { describe, it, expect } from 'vitest';
import { parseFmhy } from '../src/parsers/fmhy';

describe('parseFmhy', () => {
  it('should extract NSP links from anchor tags', () => {
    const html = `
      <html><body>
        <a href="https://example.com/zelda.nsp">Zelda TOTK</a>
        <a href="https://example.com/mario.nsp">Super Mario</a>
        <a href="https://example.com/readme.txt">Not a game</a>
      </body></html>
    `;
    const entries = parseFmhy(html);
    expect(entries).toHaveLength(2);
    expect(entries[0].gameName).toBe('Zelda TOTK');
    expect(entries[0].downloadUrl).toBe('https://example.com/zelda.nsp');
    expect(entries[0].sourceName).toBe('FMHY');
    expect(entries[0].sourceUrl).toBe('https://fmhy.net/gamingpiracyguide#nintendo-roms');
    expect(entries[1].gameName).toBe('Super Mario');
    expect(entries[1].downloadUrl).toBe('https://example.com/mario.nsp');
  });

  it('should return empty array when no NSP links exist', () => {
    const html = `
      <html><body>
        <a href="https://example.com/readme.txt">Readme</a>
        <a href="https://example.com/game.zip">Zip file</a>
      </body></html>
    `;
    expect(parseFmhy(html)).toEqual([]);
  });

  it('should return empty array for empty HTML', () => {
    expect(parseFmhy('')).toEqual([]);
  });

  it('should handle case-insensitive .nsp extensions', () => {
    const html = `<a href="https://example.com/game.NSP">Game</a>`;
    const entries = parseFmhy(html);
    expect(entries).toHaveLength(1);
    expect(entries[0].gameName).toBe('Game');
  });

  it('should fall back to URL filename when link text is empty', () => {
    const html = `<a href="https://example.com/cool-game.nsp"></a>`;
    const entries = parseFmhy(html);
    expect(entries).toHaveLength(1);
    expect(entries[0].gameName).toBe('cool game');
  });

  it('should set index to 0 for all entries', () => {
    const html = `
      <a href="https://example.com/a.nsp">A</a>
      <a href="https://example.com/b.nsp">B</a>
    `;
    const entries = parseFmhy(html);
    expect(entries.every(e => e.index === 0)).toBe(true);
  });
});
