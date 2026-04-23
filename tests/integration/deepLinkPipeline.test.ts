import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, FetchResult, DetailPageResult } from '../../src/types';

// Mock only the fetcher and progress — let real orchestrator, parser, and formatter run
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** Deep-link source using the registered NspGameHub parser */
const deepLinkSource: Source = {
  url: 'https://nspgamehub.com',
  name: 'NspGameHub',
  requiresJs: false,
  deepLink: true,
};

/** Listing page HTML with game links to detail pages on the same domain */
const listingPageHtml = `<html><body>
  <a href="https://nspgamehub.com/game/zelda-totk">Zelda TOTK</a>
  <a href="https://nspgamehub.com/game/mario-wonder">Mario Wonder</a>
  <a href="https://nspgamehub.com/game/metroid-dread">Metroid Dread</a>
</body></html>`;

/** Detail page HTML keyed by game URL, each with a title, h1, and .nsp download link */
const detailPages: Record<string, string> = {
  'https://nspgamehub.com/game/zelda-totk': `<html>
    <head><title>Zelda Tears of the Kingdom</title></head>
    <body>
      <h1>Zelda Tears of the Kingdom</h1>
      <a href="https://dl.nspgamehub.com/zelda-totk.nsp">Download NSP</a>
    </body>
  </html>`,
  'https://nspgamehub.com/game/mario-wonder': `<html>
    <head><title>Super Mario Bros Wonder</title></head>
    <body>
      <h1>Super Mario Bros Wonder</h1>
      <a href="https://dl.nspgamehub.com/mario-wonder.nsp">Download NSP</a>
    </body>
  </html>`,
  'https://nspgamehub.com/game/metroid-dread': `<html>
    <head><title>Metroid Dread</title></head>
    <body>
      <h1>Metroid Dread</h1>
      <a href="https://dl.nspgamehub.com/metroid-dread.nsp">Download NSP</a>
    </body>
  </html>`,
};

describe('Deep Link End-to-End Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetchSource to return listing page HTML for the deep-link source
    mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
      if (s.name === 'NspGameHub') {
        return { source: s, html: listingPageHtml, error: null };
      }
      return { source: s, html: null, error: `Unknown source: ${s.name}` };
    });

    // Mock fetchDetailPages to return detail page HTML for each game link
    mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
      return gameLinks.map((gl) => {
        const html = detailPages[gl.url] ?? null;
        return {
          gameLink: gl,
          html,
          error: html ? null : `Failed to fetch ${gl.url}`,
        } as DetailPageResult;
      });
    });
  });

  it('should produce correct GameEntry records from a deep-link source end-to-end', async () => {
    const { entries, errors } = await scrapeAll([deepLinkSource]);

    // No errors expected
    expect(errors).toHaveLength(0);

    // 3 game links on the listing page → 3 entries
    expect(entries).toHaveLength(3);

    // Verify sequential indices starting from 1
    entries.forEach((entry, i) => {
      expect(entry.index).toBe(i + 1);
    });

    // Verify each entry has all required fields populated
    for (const entry of entries) {
      expect(entry.gameName).toBeTruthy();
      expect(entry.downloadUrl).toBeTruthy();
      expect(entry.downloadUrl).toMatch(/\.nsp$/i);
      expect(entry.sourceName).toBe('NspGameHub');
      expect(entry.sourceUrl).toBe('https://nspgamehub.com');
      expect(entry.detailPageUrl).toBeTruthy();
      expect(entry.detailPageUrl).toMatch(/^https:\/\/nspgamehub\.com\/game\//);
    }
  });

  it('should populate detailPageUrl matching the game link URL for each entry', async () => {
    const { entries } = await scrapeAll([deepLinkSource]);

    const detailUrls = entries.map((e) => e.detailPageUrl);
    expect(detailUrls).toContain('https://nspgamehub.com/game/zelda-totk');
    expect(detailUrls).toContain('https://nspgamehub.com/game/mario-wonder');
    expect(detailUrls).toContain('https://nspgamehub.com/game/metroid-dread');
  });

  it('should extract game names from detail page titles', async () => {
    const { entries } = await scrapeAll([deepLinkSource]);

    const gameNames = entries.map((e) => e.gameName);
    expect(gameNames).toContain('Zelda Tears of the Kingdom');
    expect(gameNames).toContain('Super Mario Bros Wonder');
    expect(gameNames).toContain('Metroid Dread');
  });

  it('should extract .nsp download URLs from detail pages', async () => {
    const { entries } = await scrapeAll([deepLinkSource]);

    const downloadUrls = entries.map((e) => e.downloadUrl);
    expect(downloadUrls).toContain('https://dl.nspgamehub.com/zelda-totk.nsp');
    expect(downloadUrls).toContain('https://dl.nspgamehub.com/mario-wonder.nsp');
    expect(downloadUrls).toContain('https://dl.nspgamehub.com/metroid-dread.nsp');
  });
});
