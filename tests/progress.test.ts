import { describe, it, expect, vi } from 'vitest';
import { reportFetching, reportParsing, reportComplete } from '../src/progress';
import { Source } from '../src/types';

describe('progress reporter', () => {
  const source: Source = { url: 'https://example.com', name: 'TestSource', requiresJs: false };

  it('reportFetching logs source name and URL', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    reportFetching(source);
    expect(spy).toHaveBeenCalledWith('Fetching TestSource (https://example.com)...');
    spy.mockRestore();
  });

  it('reportParsing logs source name', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    reportParsing(source);
    expect(spy).toHaveBeenCalledWith('Parsing TestSource for .nsp links...');
    spy.mockRestore();
  });

  it('reportComplete logs completion message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    reportComplete();
    expect(spy).toHaveBeenCalledWith('Scraping complete.');
    spy.mockRestore();
  });
});
