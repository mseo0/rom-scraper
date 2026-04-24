import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Source,
  GameEntry,
  FetchResult,
  ParseResult,
  GameLink,
  DetailPageResult,
  DeepLinkParser,
  SourceParser,
} from '../src/types';

vi.mock('../src/fetcher');
vi.mock('../src/parser');
vi.mock('../src/progress');

import { fetchSource, fetchDetailPages } from '../src/fetcher';
import { parseSource, getDeepLinkParser, getSourceParser } from '../src/parser';
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
const mockedGetSourceParser = vi.mocked(getSourceParser);
const mockedReportFetching = vi.mocked(reportFetching);
const mockedReportParsing = vi.mocked(reportParsing);
const mockedReportComplete = vi.mocked(reportComplete);
const mockedReportExtractingLinks = vi.mocked(reportExtractingLinks);
const mockedReportFetchingDetails = vi.mocked(reportFetchingDetails);
const mockedReportExtractingDownloads = vi.mocked(reportExtractingDownloads);

// --- Test fixtures ---

const multiLayerSource: Source = {
  url: 'https://multi.example.com',
  name: 'MultiSource',
  requiresJs: false,
};

const deepLinkSource: Source = {
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

const unregisteredSource: Source = {
  url: 'https://unknown.example.com',
  name: 'UnknownSource',
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

function makeMockSourceParser(
  gameLinks: GameLink[],
  downloadFactory: (html: string, detailPageUrl: string) => { gameName: string; urls: string[] },
): SourceParser {
  return {
    extractGameLinks: vi.fn().mockReturnValue(gameLinks),
    extractDownloadLinks: vi.fn().mockImplementation(downloadFactory),
  };
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

describe('scrapeAll — multi-layer pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no parsers registered
    mockedGetSourceParser.mockReturnValue(undefined);
    mockedGetDeepLinkParser.mockReturnValue(undefined);
  });

  // --- Requirement 5.4, 6.1: Source with SourceParser uses multi-layer pipeline ---
  it('uses multi-layer pipeline when SourceParser is registered', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://multi.example.com/game/zelda', title: 'Zelda' },
      { url: 'https://multi.example.com/game/mario', title: 'Mario' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>zelda detail</html>', error: null },
      { gameLink: gameLinks[1], html: '<html>mario detail</html>', error: null },
    ];

    const mockParser = makeMockSourceParser(gameLinks, (_html, detailPageUrl) => ({
      gameName: detailPageUrl.includes('zelda') ? 'Zelda TOTK' : 'Super Mario',
      urls: [
        `https://mega.nz/file/${detailPageUrl.split('/').pop()}`,
        `https://mediafire.com/file/${detailPageUrl.split('/').pop()}`,
      ],
    }));

    mockedGetSourceParser.mockImplementation((name: string) =>
      name === 'MultiSource' ? mockParser : undefined,
    );
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(multiLayerSource, '<html>catalog</html>'));
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    const result = await scrapeAll([multiLayerSource]);

    // Verify multi-layer pipeline was used
    expect(mockedGetSourceParser).toHaveBeenCalledWith('MultiSource');
    expect(mockParser.extractGameLinks).toHaveBeenCalledWith('<html>catalog</html>', multiLayerSource.url);
    expect(mockedFetchDetailPages).toHaveBeenCalledWith(gameLinks, multiLayerSource, 5);
    expect(mockParser.extractDownloadLinks).toHaveBeenCalledTimes(2);

    // Verify entries produced
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].gameName).toBe('Zelda TOTK');
    expect(result.entries[0].downloadLinks).toBeDefined();
    expect(result.entries[0].downloadLinks!.length).toBeGreaterThan(0);
    expect(result.entries[0].detailPageUrl).toBe('https://multi.example.com/game/zelda');
    expect(result.entries[1].gameName).toBe('Super Mario');
    expect(result.entries[1].detailPageUrl).toBe('https://multi.example.com/game/mario');

    // Single-pass pipeline NOT called
    expect(mockedParseSource).not.toHaveBeenCalled();
    expect(mockedReportParsing).not.toHaveBeenCalled();
  });

  // --- Requirement 5.4: Source with DeepLinkParser uses legacy deep-link pipeline ---
  it('uses legacy deep-link pipeline when DeepLinkParser is registered', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://deep.example.com/game/1', title: 'Deep Game' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>detail</html>', error: null },
    ];

    const mockParser = makeMockDeepLinkParser(gameLinks, (_html, gameLink, source) => ({
      index: 0,
      gameName: 'Deep Game',
      downloadUrl: 'https://deep.example.com/game1.nsp',
      sourceName: source.name,
      sourceUrl: source.url,
      detailPageUrl: gameLink.url,
    }));

    mockedGetDeepLinkParser.mockImplementation((name: string) =>
      name === 'DeepSource' ? mockParser : undefined,
    );
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepLinkSource, '<html>listing</html>'));
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    const result = await scrapeAll([deepLinkSource]);

    // Verify deep-link pipeline was used
    expect(mockedGetDeepLinkParser).toHaveBeenCalledWith('DeepSource');
    expect(mockParser.extractGameLinks).toHaveBeenCalledWith('<html>listing</html>', deepLinkSource.url);
    expect(mockParser.extractDownloadEntry).toHaveBeenCalled();

    // SourceParser NOT used
    expect(mockedGetSourceParser).toHaveBeenCalledWith('DeepSource');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].gameName).toBe('Deep Game');
  });

  // --- Requirement 6.1: Source with neither parser uses single-pass pipeline ---
  it('uses single-pass pipeline when no SourceParser or DeepLinkParser is registered', async () => {
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

    // Verify single-pass pipeline was used
    expect(mockedParseSource).toHaveBeenCalledWith(singlePassSource, '<html>single</html>');
    expect(mockedReportParsing).toHaveBeenCalledWith(singlePassSource);

    // Deep-link and multi-layer NOT used
    expect(mockedFetchDetailPages).not.toHaveBeenCalled();

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].gameName).toBe('SingleGame');
    // Single-pass entries get downloadLinks wrapped for backward compat
    expect(result.entries[0].downloadLinks).toBeDefined();
    expect(result.entries[0].downloadLinks![0].url).toBe('https://single.example.com/game.nsp');
  });

  // --- Requirement 9.2: Source with no registered parser logs warning and skips ---
  it('logs warning and skips source with no registered parser (single-pass fallthrough)', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(unregisteredSource, '<html>unknown</html>'));
    mockedParseSource.mockReturnValueOnce(
      makeParseResult(unregisteredSource, [], `Unknown source: ${unregisteredSource.name}`),
    );

    const result = await scrapeAll([unregisteredSource]);

    // Falls through to single-pass, which logs "Unknown source"
    const output = stdoutSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain(`Unknown source: ${unregisteredSource.name}`);
    expect(result.entries).toHaveLength(0);

    stdoutSpy.mockRestore();
  });

  // --- Requirement 8.1: Catalog page fetch failure records error and continues ---
  it('records error and continues to next source when catalog page fetch fails', async () => {
    const entry: GameEntry = {
      index: 0,
      gameName: 'FallbackGame',
      downloadUrl: 'https://single.example.com/game.nsp',
      sourceName: 'SingleSource',
      sourceUrl: 'https://single.example.com',
    };

    const gameLinks: GameLink[] = [
      { url: 'https://multi.example.com/game/1', title: 'Game 1' },
    ];

    const mockParser = makeMockSourceParser(gameLinks, () => ({
      gameName: 'Game 1',
      urls: ['https://mega.nz/file/abc'],
    }));

    mockedGetSourceParser.mockImplementation((name: string) =>
      name === 'MultiSource' ? mockParser : undefined,
    );

    // Multi-layer source fetch fails
    mockedFetchSource.mockResolvedValueOnce(
      makeFetchError(multiLayerSource, 'HTTP error 500 fetching https://multi.example.com'),
    );
    // Single-pass source succeeds
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(singlePassSource, '<html>single</html>'));
    mockedParseSource.mockReturnValueOnce(makeParseResult(singlePassSource, [entry]));

    const result = await scrapeAll([multiLayerSource, singlePassSource]);

    // Error recorded for failed source
    expect(result.errors).toContain('HTTP error 500 fetching https://multi.example.com');

    // Second source still processed
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].gameName).toBe('FallbackGame');
    expect(result.entries[0].index).toBe(1);
  });

  // --- Requirement 8.2, 8.3: All detail pages fail reports error and continues ---
  it('reports errors and continues to next source when all detail pages fail', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://multi.example.com/game/1', title: 'Game 1' },
      { url: 'https://multi.example.com/game/2', title: 'Game 2' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: null, error: 'HTTP error 404 fetching game/1' },
      { gameLink: gameLinks[1], html: null, error: 'Connection timeout fetching game/2' },
    ];

    const mockParser = makeMockSourceParser(gameLinks, () => ({
      gameName: 'Game',
      urls: ['https://mega.nz/file/abc'],
    }));

    mockedGetSourceParser.mockImplementation((name: string) =>
      name === 'MultiSource' ? mockParser : undefined,
    );

    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(multiLayerSource, '<html>catalog</html>'));
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    // Add a second source that succeeds
    const entry: GameEntry = {
      index: 0,
      gameName: 'OtherGame',
      downloadUrl: 'https://single.example.com/other.nsp',
      sourceName: 'SingleSource',
      sourceUrl: 'https://single.example.com',
    };
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(singlePassSource, '<html>single</html>'));
    mockedParseSource.mockReturnValueOnce(makeParseResult(singlePassSource, [entry]));

    const result = await scrapeAll([multiLayerSource, singlePassSource]);

    // Both detail page errors recorded
    expect(result.errors).toContain('HTTP error 404 fetching game/1');
    expect(result.errors).toContain('Connection timeout fetching game/2');

    // No entries from the failed multi-layer source
    const multiEntries = result.entries.filter((e) => e.sourceName === 'MultiSource');
    expect(multiEntries).toHaveLength(0);

    // Second source still processed successfully
    const singleEntries = result.entries.filter((e) => e.sourceName === 'SingleSource');
    expect(singleEntries).toHaveLength(1);
    expect(singleEntries[0].index).toBe(1);
  });

  // --- Requirement 8.1, 8.2, 8.3: Progress reporting called for each multi-layer phase ---
  it('calls progress reporters in correct order for multi-layer pipeline', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://multi.example.com/game/1', title: 'Game 1' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>detail</html>', error: null },
    ];

    const mockParser = makeMockSourceParser(gameLinks, () => ({
      gameName: 'Game 1',
      urls: ['https://mega.nz/file/abc123'],
    }));

    mockedGetSourceParser.mockImplementation((name: string) =>
      name === 'MultiSource' ? mockParser : undefined,
    );
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(multiLayerSource, '<html>catalog</html>'));
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    await scrapeAll([multiLayerSource]);

    // Verify all multi-layer progress reporters called
    expect(mockedReportFetching).toHaveBeenCalledWith(multiLayerSource);
    expect(mockedReportExtractingLinks).toHaveBeenCalledWith(multiLayerSource);
    expect(mockedReportFetchingDetails).toHaveBeenCalledWith(multiLayerSource, 1);
    expect(mockedReportExtractingDownloads).toHaveBeenCalledWith(multiLayerSource);
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

  // --- Requirement 6.3: Single-pass progress reporters NOT called for multi-layer ---
  it('does not call single-pass progress reporters for multi-layer sources', async () => {
    const gameLinks: GameLink[] = [
      { url: 'https://multi.example.com/game/1', title: 'Game 1' },
    ];

    const detailResults: DetailPageResult[] = [
      { gameLink: gameLinks[0], html: '<html>detail</html>', error: null },
    ];

    const mockParser = makeMockSourceParser(gameLinks, () => ({
      gameName: 'Game 1',
      urls: ['https://mega.nz/file/abc123'],
    }));

    mockedGetSourceParser.mockImplementation((name: string) =>
      name === 'MultiSource' ? mockParser : undefined,
    );
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(multiLayerSource, '<html>catalog</html>'));
    mockedFetchDetailPages.mockResolvedValueOnce(detailResults);

    await scrapeAll([multiLayerSource]);

    // reportParsing is single-pass only — should NOT be called
    expect(mockedReportParsing).not.toHaveBeenCalled();
  });

  // --- Requirement 6.5: Mixed sources produce sequential indices ---
  it('assigns sequential indices across multi-layer, deep-link, and single-pass sources', async () => {
    // 1. Multi-layer source (2 entries)
    const mlGameLinks: GameLink[] = [
      { url: 'https://multi.example.com/game/1', title: 'ML Game 1' },
      { url: 'https://multi.example.com/game/2', title: 'ML Game 2' },
    ];
    const mlDetailResults: DetailPageResult[] = [
      { gameLink: mlGameLinks[0], html: '<html>ml detail 1</html>', error: null },
      { gameLink: mlGameLinks[1], html: '<html>ml detail 2</html>', error: null },
    ];
    const mlParser = makeMockSourceParser(mlGameLinks, (_html, url) => ({
      gameName: url.includes('1') ? 'ML Game 1' : 'ML Game 2',
      urls: [`https://mega.nz/file/${url.split('/').pop()}`],
    }));

    // 2. Deep-link source (1 entry)
    const dlGameLinks: GameLink[] = [
      { url: 'https://deep.example.com/game/1', title: 'DL Game 1' },
    ];
    const dlDetailResults: DetailPageResult[] = [
      { gameLink: dlGameLinks[0], html: '<html>dl detail</html>', error: null },
    ];
    const dlParser = makeMockDeepLinkParser(dlGameLinks, (_html, gameLink, source) => ({
      index: 0,
      gameName: 'DL Game 1',
      downloadUrl: 'https://deep.example.com/game1.nsp',
      sourceName: source.name,
      sourceUrl: source.url,
      detailPageUrl: gameLink.url,
    }));

    // 3. Single-pass source (1 entry)
    const spEntry: GameEntry = {
      index: 0,
      gameName: 'SP Game 1',
      downloadUrl: 'https://single.example.com/game.nsp',
      sourceName: 'SingleSource',
      sourceUrl: 'https://single.example.com',
    };

    mockedGetSourceParser.mockImplementation((name: string) =>
      name === 'MultiSource' ? mlParser : undefined,
    );
    mockedGetDeepLinkParser.mockImplementation((name: string) =>
      name === 'DeepSource' ? dlParser : undefined,
    );

    // Fetch calls in order: multi-layer, deep-link, single-pass
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(multiLayerSource, '<html>ml catalog</html>'));
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(deepLinkSource, '<html>dl listing</html>'));
    mockedFetchSource.mockResolvedValueOnce(makeFetchOk(singlePassSource, '<html>sp page</html>'));

    mockedFetchDetailPages.mockResolvedValueOnce(mlDetailResults);
    mockedFetchDetailPages.mockResolvedValueOnce(dlDetailResults);

    mockedParseSource.mockReturnValueOnce(makeParseResult(singlePassSource, [spEntry]));

    const result = await scrapeAll([multiLayerSource, deepLinkSource, singlePassSource]);

    expect(result.entries).toHaveLength(4);
    expect(result.entries[0].index).toBe(1);
    expect(result.entries[1].index).toBe(2);
    expect(result.entries[2].index).toBe(3);
    expect(result.entries[3].index).toBe(4);

    // Verify source ordering
    expect(result.entries[0].sourceName).toBe('MultiSource');
    expect(result.entries[1].sourceName).toBe('MultiSource');
    expect(result.entries[2].sourceName).toBe('DeepSource');
    expect(result.entries[3].sourceName).toBe('SingleSource');
  });
});
