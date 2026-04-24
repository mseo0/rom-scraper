import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, GameEntry, FetchResult, ParseResult } from '../src/types';

vi.mock('../src/fetcher');
vi.mock('../src/parser');
vi.mock('../src/progress');

import { fetchSource } from '../src/fetcher';
import { parseSource } from '../src/parser';
import { reportFetching, reportParsing, reportComplete } from '../src/progress';
import { scrapeAll } from '../src/orchestrator';

const mockedFetch = vi.mocked(fetchSource);
const mockedParse = vi.mocked(parseSource);
const mockedReportFetching = vi.mocked(reportFetching);
const mockedReportParsing = vi.mocked(reportParsing);
const mockedReportComplete = vi.mocked(reportComplete);

const sourceA: Source = { url: 'https://a.com', name: 'SourceA', requiresJs: false };
const sourceB: Source = { url: 'https://b.com', name: 'SourceB', requiresJs: false };

function makeFetchOk(source: Source, html: string): FetchResult {
  return { source, html, error: null };
}

function makeFetchError(source: Source, error: string): FetchResult {
  return { source, html: null, error };
}

function makeParseResult(source: Source, entries: GameEntry[], message: string | null = null): ParseResult {
  return { source, entries, message };
}

describe('scrapeAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should collect entries from multiple sources with sequential indices', async () => {
    const entryA: GameEntry = { index: 0, gameName: 'GameA', downloadUrl: 'https://a.com/a.nsp', sourceName: 'SourceA', sourceUrl: 'https://a.com' };
    const entryB: GameEntry = { index: 0, gameName: 'GameB', downloadUrl: 'https://b.com/b.nsp', sourceName: 'SourceB', sourceUrl: 'https://b.com' };

    mockedFetch.mockResolvedValueOnce(makeFetchOk(sourceA, '<html>A</html>'));
    mockedFetch.mockResolvedValueOnce(makeFetchOk(sourceB, '<html>B</html>'));
    mockedParse.mockReturnValueOnce(makeParseResult(sourceA, [entryA]));
    mockedParse.mockReturnValueOnce(makeParseResult(sourceB, [entryB]));

    const result = await scrapeAll([sourceA, sourceB]);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].index).toBe(1);
    expect(result.entries[1].index).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should record errors and skip parsing when fetch fails', async () => {
    mockedFetch.mockResolvedValueOnce(makeFetchError(sourceA, 'HTTP error 500 fetching https://a.com'));

    const result = await scrapeAll([sourceA]);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toEqual(['HTTP error 500 fetching https://a.com']);
    expect(mockedParse).not.toHaveBeenCalled();
    expect(mockedReportParsing).not.toHaveBeenCalled();
  });

  it('should continue processing remaining sources after a fetch failure', async () => {
    const entryB: GameEntry = { index: 0, gameName: 'GameB', downloadUrl: 'https://b.com/b.nsp', sourceName: 'SourceB', sourceUrl: 'https://b.com' };

    mockedFetch.mockResolvedValueOnce(makeFetchError(sourceA, 'Connection failed'));
    mockedFetch.mockResolvedValueOnce(makeFetchOk(sourceB, '<html>B</html>'));
    mockedParse.mockReturnValueOnce(makeParseResult(sourceB, [entryB]));

    const result = await scrapeAll([sourceA, sourceB]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].index).toBe(1);
    expect(result.errors).toEqual(['Connection failed']);
  });

  it('should log message when no links found on a source', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockedFetch.mockResolvedValueOnce(makeFetchOk(sourceA, '<html>empty</html>'));
    mockedParse.mockReturnValueOnce(makeParseResult(sourceA, [], 'No .nsp files found on SourceA'));

    const result = await scrapeAll([sourceA]);

    expect(result.entries).toHaveLength(0);
    const output = stdoutSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('No .nsp files found on SourceA');
    stdoutSpy.mockRestore();
  });

  it('should call progress reporters in correct order', async () => {
    const entry: GameEntry = { index: 0, gameName: 'Game', downloadUrl: 'https://a.com/g.nsp', sourceName: 'SourceA', sourceUrl: 'https://a.com' };
    mockedFetch.mockResolvedValueOnce(makeFetchOk(sourceA, '<html></html>'));
    mockedParse.mockReturnValueOnce(makeParseResult(sourceA, [entry]));

    await scrapeAll([sourceA]);

    expect(mockedReportFetching).toHaveBeenCalledWith(sourceA);
    expect(mockedReportParsing).toHaveBeenCalledWith(sourceA);
    expect(mockedReportComplete).toHaveBeenCalled();
  });

  it('should return empty results for empty sources array', async () => {
    const result = await scrapeAll([]);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(mockedReportComplete).toHaveBeenCalled();
  });

  it('should return all errors when every source fails', async () => {
    mockedFetch.mockResolvedValueOnce(makeFetchError(sourceA, 'HTTP error 500 fetching https://a.com'));
    mockedFetch.mockResolvedValueOnce(makeFetchError(sourceB, 'Connection failed fetching https://b.com: ECONNREFUSED'));

    const result = await scrapeAll([sourceA, sourceB]);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain('HTTP error 500 fetching https://a.com');
    expect(result.errors).toContain('Connection failed fetching https://b.com: ECONNREFUSED');
    expect(mockedReportComplete).toHaveBeenCalled();
  });

  it('should return empty entries when all sources succeed but find no .nsp links', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockedFetch.mockResolvedValueOnce(makeFetchOk(sourceA, '<html>no links</html>'));
    mockedFetch.mockResolvedValueOnce(makeFetchOk(sourceB, '<html>no links</html>'));
    mockedParse.mockReturnValueOnce(makeParseResult(sourceA, [], 'No .nsp files found on SourceA'));
    mockedParse.mockReturnValueOnce(makeParseResult(sourceB, [], 'No .nsp files found on SourceB'));

    const result = await scrapeAll([sourceA, sourceB]);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    const output = stdoutSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('No .nsp files found on SourceA');
    expect(output).toContain('No .nsp files found on SourceB');
    expect(mockedReportComplete).toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });
});
