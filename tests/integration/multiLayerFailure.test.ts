import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, FetchResult, DetailPageResult } from '../../src/types';

// Mock only the fetcher (HTTP layer) and progress — parsers, file host registry, and orchestrator run for real
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** Multi-layer source (Ziperto) — uses real parser via sourceParserMap */
const zipertoSource: Source = {
  url: 'https://www.ziperto.com/nintendo-switch-nsp/',
  name: 'Ziperto',
  requiresJs: true,
};

/** Single-pass source (FMHY) — uses real parser via parserMap */
const fmhySource: Source = {
  url: 'https://fmhy.net/gamingpiracyguide#nintendo-roms',
  name: 'FMHY',
  requiresJs: true,
};

/** Ziperto catalog page HTML with 3 game links the real parser can extract */
const zipertoCatalogHtml = `<!DOCTYPE html>
<html>
<head><title>Nintendo Switch NSP - Ziperto</title></head>
<body>
<div id="main" class="site-main">
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/zelda-totk/">The Legend of Zelda: Tears of the Kingdom</a>
    </h2>
  </article>
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/mario-wonder/">Super Mario Bros. Wonder</a>
    </h2>
  </article>
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/metroid-dread/">Metroid Dread</a>
    </h2>
  </article>
</div>
</body>
</html>`;

/** FMHY single-pass page with direct .nsp download links */
const fmhyHtml = `<html><body>
  <a href="https://dl.fmhy.com/splatoon3.nsp">Splatoon 3</a>
  <a href="https://dl.fmhy.com/pikmin4.nsp">Pikmin 4</a>
</body></html>`;

describe('Multi-Layer Full Failure Integration (Ziperto all detail pages fail, FMHY succeeds)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetchSource: Ziperto returns catalog HTML, FMHY returns single-pass HTML
    mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
      if (s.name === 'Ziperto') {
        return { source: s, html: zipertoCatalogHtml, error: null };
      }
      if (s.name === 'FMHY') {
        return { source: s, html: fmhyHtml, error: null };
      }
      return { source: s, html: null, error: `Unknown source: ${s.name}` };
    });

    // Mock fetchDetailPages: ALL detail pages fail with errors
    mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
      return gameLinks.map((gl) => ({
        gameLink: gl,
        html: null,
        error: `Request timed out fetching ${gl.url}`,
      } as DetailPageResult));
    });
  });

  it('should record all detail page errors from the multi-layer source', async () => {
    const { errors } = await scrapeAll([zipertoSource, fmhySource]);

    // 3 detail page errors from Ziperto (one per game link)
    const zipertoErrors = errors.filter((e) => e.includes('ziperto.com'));
    expect(zipertoErrors).toHaveLength(3);
    expect(zipertoErrors.every((e) => e.includes('timed out'))).toBe(true);
    expect(zipertoErrors.some((e) => e.includes('zelda-totk'))).toBe(true);
    expect(zipertoErrors.some((e) => e.includes('mario-wonder'))).toBe(true);
    expect(zipertoErrors.some((e) => e.includes('metroid-dread'))).toBe(true);
  });

  it('should produce no entries from the failed multi-layer source', async () => {
    const { entries } = await scrapeAll([zipertoSource, fmhySource]);

    const zipertoEntries = entries.filter((e) => e.sourceName === 'Ziperto');
    expect(zipertoEntries).toHaveLength(0);
  });

  it('should still process the second source (FMHY) and produce its entries', async () => {
    const { entries } = await scrapeAll([zipertoSource, fmhySource]);

    const fmhyEntries = entries.filter((e) => e.sourceName === 'FMHY');
    expect(fmhyEntries).toHaveLength(2);
    expect(fmhyEntries[0].gameName).toBe('Splatoon 3');
    expect(fmhyEntries[1].gameName).toBe('Pikmin 4');
  });

  it('should assign sequential indices starting from 1 for the successful source', async () => {
    const { entries } = await scrapeAll([zipertoSource, fmhySource]);

    // Only FMHY entries, sequentially indexed from 1
    expect(entries).toHaveLength(2);
    expect(entries[0].index).toBe(1);
    expect(entries[1].index).toBe(2);
  });
});
