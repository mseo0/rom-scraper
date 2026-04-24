import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs } from '../src/index';

describe('parseArgs', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('returns searchQuery as null when no args are provided', () => {
    const result = parseArgs(['node', 'script.js']);
    expect(result).toEqual({ searchQuery: null });
  });

  it('returns the search term when --search is followed by a value', () => {
    const result = parseArgs(['node', 'script.js', '--search', 'zelda']);
    expect(result).toEqual({ searchQuery: 'zelda' });
  });

  it('calls process.exit(1) when --search is at the end with no value', () => {
    expect(() => parseArgs(['node', 'script.js', '--search'])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: --search requires a search term.');
  });

  it('calls process.exit(1) when --search value is whitespace-only', () => {
    expect(() => parseArgs(['node', 'script.js', '--search', '  '])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: --search requires a search term.');
  });

  it('treats bare arguments as the search query', () => {
    const result = parseArgs(['node', 'script.js', 'zelda']);
    expect(result).toEqual({ searchQuery: 'zelda' });
  });

  it('joins multiple bare arguments into a single search query', () => {
    const result = parseArgs(['node', 'script.js', 'fire', 'emblem']);
    expect(result).toEqual({ searchQuery: 'fire emblem' });
  });

  it('prefers --search flag over bare arguments', () => {
    const result = parseArgs(['node', 'script.js', '--search', 'zelda', 'mario']);
    expect(result).toEqual({ searchQuery: 'zelda' });
  });
});
