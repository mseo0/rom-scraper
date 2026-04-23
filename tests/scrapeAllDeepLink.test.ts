import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Source,
  GameEntry,
  FetchResult,
  ParseResult,
  GameLink,
  DetailPageResult,
  DeepLinkParser,
} from '../src/types';

vi.mock('../src/fetcher');
vi.mock('../src/parser');
vi.mock('../src/progress');

import { fetchSource, fetchDetailPages } from '../src/fetcher';
import { parseSource, getDeepLinkParser } from '../src/parser';
import {
  reportFetching,
  reportParsing,
  reportComplete,
  reportExtractingLinks,
  reportFetchingDetails,
  reportExtractingDownloads,
} from '../src/progress';
import { scrapeAll } from '../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);
const mockedParseSource = vi.mocked(parseSource);
const mockedGetDeepLinkParser = vi.mocked(getDeepLinkParser);
const mockedReportFetching = vi.mocked(reportFetching);
const mockedReportParsing = vi.mocked(reportParsing);
const mockedReportComplete = vi.mocked(reportComplete);
const mockedReportExtractingLinks = vi.mocked(reportExtractingLinks);
const mockedReportFetchingDetails = vi.mocked(reportFetchingDetails);
const mockedReportExtractingDownloads = vi.mocked(reportExtractingDownloads);

// --- Test fixtures ---

const deepSource: Source = {
  url: 'https://deep.example.com',
  name: 'DeepSource',
  requiresJs: false,
  deepLink: true,
};

const singlePassSource: Source = {
  url: 'https://single.example.com',
  name: 'SingleSource',
  requiresJs: false,
};

function makeFetchOk(source: Source, html: string): FetchResult {
  return { source, html, error: null };
}

function makeFetchError(source: Source, error: string): FetchResult {
  return { source, html: null, error };
}

function makeParseResult(
  source: Source,
  entries: GameEntry[],
  message: string | null = null,
): ParseResult {
  return { source, entries, message };
}

function makeMockDeepLinkParser(
  gameLinks: GameLink[],
  entryFactory: (html: string, gameLink: GameLink, source: Source) => GameEntry | null,
): DeepLinkParser {
  return {
    extractGameLinks: vi.fn().mockReturnValue(gameLinks),
    extractDownloadEntry: vi.fn().mockImplementation(entryFactory),
  };
}

describe('scrapeAll — deep link branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Test 1: Deep-link source calls pipeline in order ---
  it('calls extractGameLinks, fetchDetailPages, extractDownloadEntry in order for deep-link sources', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://deep.example.com/game1', title: 'Game 1' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>detail1</html>', error: null },
    ];

    const mockParser = makeMockDeepLinkParser(gameLinks, (_html, gameLink, source) => ({
      index: 0,
      gameName: 'Game 1',
      downloadUrl: 'https://deep.example.com/game1.nsp',
      sourceName: source.name,
      sourceUrl: source.url,
      detailPageUrl: gameLink.url,
    }));

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepSource, '<html>listing</html>'));
    mockedGetDeepLinkParser.mockReturnValue(mockParser);
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    const result = await scrapeAll([deepSource]);

    // Verify pipeline order
    expect(mockedFetchSource).toHaveBeenCalledWith(deepSource);
    expect(mockParser.extractGameLinks).toHaveBeenCalledWith('<html>listing</html>', deepSource.url);
    expect(mockedFetchDetailPages).toHaveBeenCalledWith(gameLinks, deepSource, 5);
    expect(mockParser.extractDownloadEntry).toHaveBeenCalledWith(
      '<html>detail1</html>',
      gameLinks[0],
      deepSource,
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].gameName).toBe('Game 1');
    expect(result.errors).toHaveLength(0);
  });

  // --- Test 2: Non-deep-link source uses single-pass pipeline ---
  it('uses single-pass pipeline for non-deep-link sources (no deep link functions called)', async () => {
    const entry: GameEntry = {
      index: 0,
      gameName: 'SingleGame',
      downloadUrl: 'https://single.example.com/game.nsp',
      sourceName: 'SingleSource',
      sourceUrl: 'https://single.example.com',
    };

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(singlePassSource, '<html>single</html>'));
    mockedParseSource.mockReturnValueOnce(makeParseResult(singlePassSource, [entry]));

    const result = await scrapeAll([singlePassSource]);

    // Single-pass pipeline called
    expect(mockedFetchSource).toHaveBeenCalledWith(singlePassSource);
    expect(mockedParseSource).toHaveBeenCalledWith(singlePassSource, '<html>single</html>');

    // Deep link functions NOT called
    expect(mockedGetDeepLinkParser).not.toHaveBeenCalled();
    expect(mockedFetchDetailPages).not.toHaveBeenCalled();

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].gameName).toBe('SingleGame');
  });

  // --- Test 3: Progress reporting for deep-link phases ---
  it('calls progress reporters in correct order for deep-link sources', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://deep.example.com/game1', title: 'Game 1' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>detail</html>', error: null },
    ];

    const mockParser = makeMockDeepLinkParser(gameLinks, (_html, gameLink, source) => ({
      index: 0,
      gameName: 'Game 1',
      downloadUrl: 'https://deep.example.com/game1.nsp',
      sourceName: source.name,
      sourceUrl: source.url,
      detailPageUrl: gameLink.url,
    }));

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepSource, '<html>listing</html>'));
    mockedGetDeepLinkParser.mockReturnValue(mockParser);
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    await scrapeAll([deepSource]);

    // Verify all deep-link progress reporters called
    expect(mockedReportFetching).toHaveBeenCalledWith(deepSource);
    expect(mockedReportExtractingLinks).toHaveBeenCalledWith(deepSource);
    expect(mockedReportFetchingDetails).toHaveBeenCalledWith(deepSource, 1);
    expect(mockedReportExtractingDownloads).toHaveBeenCalledWith(deepSource);
    expect(mockedReportComplete).toHaveBeenCalled();

    // Verify order: fetching → extractingLinks → fetchingDetails → extractingDownloads → complete
    const fetchingOrder = mockedReportFetching.mock.invocationCallOrder[0];
    const extractingLinksOrder = mockedReportExtractingLinks.mock.invocationCallOrder[0];
    const fetchingDetailsOrder = mockedReportFetchingDetails.mock.invocationCallOrder[0];
    const extractingDownloadsOrder = mockedReportExtractingDownloads.mock.invocationCallOrder[0];
    const completeOrder = mockedReportComplete.mock.invocationCallOrder[0];

    expect(fetchingOrder).toBeLessThan(extractingLinksOrder);
    expect(extractingLinksOrder).toBeLessThan(fetchingDetailsOrder);
    expect(fetchingDetailsOrder).toBeLessThan(extractingDownloadsOrder);
    expect(extractingDownloadsOrder).toBeLessThan(completeOrder);
  });

  // --- Test 4: Single-pass entries have detailPageUrl undefined ---
  it('single-pass entries have detailPageUrl undefined', async () => {
    const entry: GameEntry = {
      index: 0,
      gameName: 'SingleGame',
      downloadUrl: 'https://single.example.com/game.nsp',
      sourceName: 'SingleSource',
      sourceUrl: 'https://single.example.com',
    };

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(singlePassSource, '<html>single</html>'));
    mockedParseSource.mockReturnValueOnce(makeParseResult(singlePassSource, [entry]));

    const result = await scrapeAll([singlePassSource]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].detailPageUrl).toBeUndefined();
  });

  // --- Test 5: Deep-link entries have detailPageUrl populated ---
  it('deep-link entries have detailPageUrl populated', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://deep.example.com/game1', title: 'Game 1' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>detail</html>', error: null },
    ];

    const mockParser = makeMockDeepLinkParser(gameLinks, (_html, gameLink, source) => ({
      index: 0,
      gameName: 'Game 1',
      downloadUrl: 'https://deep.example.com/game1.nsp',
      sourceName: source.name,
      sourceUrl: source.url,
      detailPageUrl: gameLink.url,
    }));

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepSource, '<html>listing</html>'));
    mockedGetDeepLinkParser.mockReturnValue(mockParser);
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    const result = await scrapeAll([deepSource]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].detailPageUrl).toBe('https://deep.example.com/game1');
  });

  // --- Test 6: Missing deep link parser → logs error, skips source ---
  it('logs error and skips source when deep link parser is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepSource, '<html>listing</html>'));
    mockedGetDeepLinkParser.mockReturnValue(undefined);

    const result = await scrapeAll([deepSource]);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toContain('No deep link parser for DeepSource');
    expect(consoleSpy).toHaveBeenCalledWith('No deep link parser for DeepSource');

    // Should not attempt to fetch detail pages
    expect(mockedFetchDetailPages).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // --- Test 7: No game links found → logs message, continues ---
  it('logs message and continues when no game links found', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockParser = makeMockDeepLinkParser([], () => null);

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepSource, '<html>listing</html>'));
    mockedGetDeepLinkParser.mockReturnValue(mockParser);

    const result = await scrapeAll([deepSource]);

    expect(result.entries).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith('No game links found on DeepSource');

    // Should not attempt to fetch detail pages
    expect(mockedFetchDetailPages).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // --- Test 8: Mixed sources produce sequential indices ---
  it('mixed single-pass and deep-link sources produce sequential indices', async () => {
    // Single-pass source first
    const singleEntry: GameEntry = {
      index: 0,
      gameName: 'SingleGame',
      downloadUrl: 'https://single.example.com/game.nsp',
      sourceName: 'SingleSource',
      sourceUrl: 'https://single.example.com',
    };

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(singlePassSource, '<html>single</html>'));
    mockedParseSource.mockReturnValueOnce(makeParseResult(singlePassSource, [singleEntry]));

    // Deep-link source second
    const gameLinks: GameLink[] = [
      { url: 'https://deep.example.com/game1', title: 'Game 1' },
      { url: 'https://deep.example.com/game2', title: 'Game 2' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>detail1</html>', error: null },
      { gameLink: gameLinks[1], html: '<html>detail2</html>', error: null },
    ];

    const mockParser = makeMockDeepLinkParser(gameLinks, (_html, gameLink, source) => ({
      index: 0,
      gameName: gameLink.title,
      downloadUrl: `${gameLink.url}.nsp`,
      sourceName: source.name,
      sourceUrl: source.url,
      detailPageUrl: gameLink.url,
    }));

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepSource, '<html>listing</html>'));
    mockedGetDeepLinkParser.mockReturnValue(mockParser);
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    const result = await scrapeAll([singlePassSource, deepSource]);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].index).toBe(1);
    expect(result.entries[1].index).toBe(2);
    expect(result.entries[2].index).toBe(3);

    // Verify sources are correct
    expect(result.entries[0].sourceName).toBe('SingleSource');
    expect(result.entries[1].sourceName).toBe('DeepSource');
    expect(result.entries[2].sourceName).toBe('DeepSource');
  });
});
