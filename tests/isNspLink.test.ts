import { describe, it, expect } from 'vitest';
import { isNspLink } from '../src/parser';

describe('isNspLink', () => {
  it('returns true for a URL ending with .nsp', () => {
    expect(isNspLink('https://example.com/game.nsp')).toBe(true);
  });

  it('returns true for uppercase .NSP', () => {
    expect(isNspLink('https://example.com/game.NSP')).toBe(true);
  });

  it('returns true for mixed case .Nsp', () => {
    expect(isNspLink('https://example.com/game.Nsp')).toBe(true);
  });

  it('returns true for mixed case .nSp', () => {
    expect(isNspLink('https://example.com/game.nSp')).toBe(true);
  });

  it('returns true for .nsp with query string', () => {
    expect(isNspLink('https://example.com/game.nsp?token=abc')).toBe(true);
  });

  it('returns true for .nsp with fragment', () => {
    expect(isNspLink('https://example.com/game.nsp#section')).toBe(true);
  });

  it('returns true for .nsp with both query and fragment', () => {
    expect(isNspLink('https://example.com/game.nsp?token=abc#section')).toBe(true);
  });

  it('returns false for a .zip URL', () => {
    expect(isNspLink('https://example.com/game.zip')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isNspLink('')).toBe(false);
  });

  it('returns false for a URL with no extension', () => {
    expect(isNspLink('https://example.com/games')).toBe(false);
  });

  it('returns false when .nsp appears in path but not at the end', () => {
    expect(isNspLink('https://example.com/nsp/game.zip')).toBe(false);
  });

  it('handles relative paths ending in .nsp', () => {
    expect(isNspLink('/downloads/game.nsp')).toBe(true);
  });

  it('handles bare filename', () => {
    expect(isNspLink('game.nsp')).toBe(true);
  });
});
