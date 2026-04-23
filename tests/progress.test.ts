import { describe, it, expect, vi } from 'vitest';
import { reportFetching, reportParsing, reportComplete, reportExtractingLinks, reportFetchingDetails, reportExtractingDownloads } from '../src/progress';
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

  it('reportExtractingLinks logs source name', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    reportExtractingLinks(source);
    expect(spy).toHaveBeenCalledWith('Extracting game links from TestSource...');
    spy.mockRestore();
  });

  it('reportFetchingDetails logs source name and count', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    reportFetchingDetails(source, 5);
    expect(spy).toHaveBeenCalledWith('Fetching 5 detail pages from TestSource...');
    spy.mockRestore();
  });

  it('reportExtractingDownloads logs source name', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    reportExtractingDownloads(source);
    expect(spy).toHaveBeenCalledWith('Extracting download URLs from TestSource...');
    spy.mockRestore();
  });
});
