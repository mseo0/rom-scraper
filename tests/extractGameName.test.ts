import { describe, it, expect } from 'vitest';
import { extractGameName } from '../src/parser';

describe('extractGameName', () => {
  it('returns link text when provided', () => {
    expect(extractGameName('Zelda TOTK', 'https://example.com/zelda.nsp')).toBe('Zelda TOTK');
  });

  it('trims whitespace from link text', () => {
    expect(extractGameName('  Zelda TOTK  ', 'https://example.com/zelda.nsp')).toBe('Zelda TOTK');
  });

  it('extracts filename from URL when link text is empty', () => {
    expect(extractGameName('', 'https://example.com/Super-Mario-Wonder.nsp')).toBe('Super Mario Wonder');
  });

  it('extracts filename from URL when link text is whitespace only', () => {
    expect(extractGameName('   ', 'https://example.com/game-title.nsp')).toBe('game title');
  });

  it('removes .nsp extension from filename', () => {
    expect(extractGameName('', 'https://example.com/MyGame.nsp')).toBe('MyGame');
  });

  it('removes .NSP extension case-insensitively', () => {
    expect(extractGameName('', 'https://example.com/MyGame.NSP')).toBe('MyGame');
  });

  it('decodes URL-encoded characters (%20)', () => {
    expect(extractGameName('', 'https://example.com/My%20Game%20Title.nsp')).toBe('My Game Title');
  });

  it('replaces hyphens with spaces', () => {
    expect(extractGameName('', 'https://example.com/my-cool-game.nsp')).toBe('my cool game');
  });

  it('replaces underscores with spaces', () => {
    expect(extractGameName('', 'https://example.com/my_cool_game.nsp')).toBe('my cool game');
  });

  it('handles URL with query string', () => {
    expect(extractGameName('', 'https://example.com/game-name.nsp?token=abc')).toBe('game name');
  });

  it('handles URL with fragment', () => {
    expect(extractGameName('', 'https://example.com/game-name.nsp#section')).toBe('game name');
  });

  it('returns "Unknown Game" when both link text and URL filename are empty', () => {
    expect(extractGameName('', '')).toBe('Unknown Game');
  });

  it('returns "Unknown Game" for URL with no filename', () => {
    expect(extractGameName('', 'https://example.com/')).toBe('Unknown Game');
  });

  it('handles relative paths', () => {
    expect(extractGameName('', '/downloads/cool-game.nsp')).toBe('cool game');
  });

  it('prefers link text over URL filename', () => {
    expect(extractGameName('Preferred Name', 'https://example.com/different-name.nsp')).toBe('Preferred Name');
  });
});
