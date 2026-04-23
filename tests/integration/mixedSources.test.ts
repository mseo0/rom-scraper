import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, FetchResult, DetailPageResult } from '../../src/types';

// Mock only the fetcher and progress — let real orchestrator, parsers, and formatter run
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** Single-pass source (FMHY) — no deepLink flag, listing HTML has direct .nsp links */
const singlePassSource: Source = {
  url: 'https://fmhy.net/gamingpiracyguide#nintendo-roms',
  name: 'FMHY',
  requiresJs: false,
};

/** Deep-link source (NspGameHub) — deepLink: true, listing HTML has game page links */
const deepLinkSource: Source = {
  url: 'https://nspgamehub.com',
  name: 'NspGameHub',
  requiresJs: false,
  deepLink: true,
};

/** Single-pass listing page with direct .nsp download links */
const singlePassHtml = `<html><body>
  <a href="https://dl.fmhy.com/zelda-totk.nsp">Zelda TOTK</a>
  <a href="https://dl.fmhy.com/mario-wonder.nsp">Mario Wonder</a>
  <a href="https://dl.fmhy.com/splatoon3.nsp">Splatoon 3</a>
</body></html>`;

/** Deep-link listing page with links to game detail pages */
const deepLinkListingHtml = `<html><body>
  <a href="https://nspgamehub.com/game/metroid-dread">Metroid Dread</a>
  <a href="https://nspgamehub.com/game/pikmin4">Pikmin 4</a>
</body></html>`;

/** Detail page HTML for each deep-link game */
const detailPages: Record<string, string> = {
  'https://nspgamehub.com/game/metroid-dread': `<html>
    <head><title>Metroid Dread</title></head>
    <body>
      <h1>Metroid Dread</h1>
      <a href="https://dl.nspgamehub.com/metroid-dread.nsp">Download NSP</a>
    </body>
  </html>`,
  'https://nspgamehub.com/game/pikmin4': `<html>
    <head><title>Pikmin 4</title></head>
    <body>
      <h1>Pikmin 4</h1>
      <a href="https://dl.nspgamehub.com/pikmin4.nsp">Download NSP</a>
    </body>
  </html>`,
};

describe('Mixed Single-Pass and Deep Link Sources Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetchSource to return appropriate HTML for each source
    mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
      if (s.name === 'FMHY') {
        return { source: s, html: singlePassHtml, error: null };
      }
      if (s.name === 'NspGameHub') {
        return { source: s, html: deepLinkListingHtml, error: null };
      }
      return { source: s, html: null, error: `Unknown source: ${s.name}` };
    });

    // Mock fetchDetailPages to return detail page HTML for deep-link game links
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

  it('should produce entries from both sources with sequential indices from 1 to N', async () => {
    const { entries, errors } = await scrapeAll([singlePassSource, deepLinkSource]);

    // No errors expected
    expect(errors).toHaveLength(0);

    // Total: 3 single-pass + 2 deep-link = 5 entries
    expect(entries).toHaveLength(5);

    // Verify sequential indices: 1, 2, 3, 4, 5 — contiguous, no gaps
    const indices = entries.map((e) => e.index);
    expect(indices).toEqual([1, 2, 3, 4, 5]);
  });

  it('should not set detailPageUrl on single-pass entries', async () => {
    const { entries } = await scrapeAll([singlePassSource, deepLinkSource]);

    const singlePassEntries = entries.filter((e) => e.sourceName === 'FMHY');
    expect(singlePassEntries.length).toBe(3);

    for (const entry of singlePassEntries) {
      expect(entry.detailPageUrl).toBeUndefined();
    }
  });

  it('should populate detailPageUrl on deep-link entries', async () => {
    const { entries } = await scrapeAll([singlePassSource, deepLinkSource]);

    const deepLinkEntries = entries.filter((e) => e.sourceName === 'NspGameHub');
    expect(deepLinkEntries.length).toBe(2);

    for (const entry of deepLinkEntries) {
      expect(entry.detailPageUrl).toBeTruthy();
      expect(entry.detailPageUrl).toMatch(/^https:\/\/nspgamehub\.com\/game\//);
    }
  });

  it('should include entries from both sources', async () => {
    const { entries } = await scrapeAll([singlePassSource, deepLinkSource]);

    const sourceNames = new Set(entries.map((e) => e.sourceName));
    expect(sourceNames.size).toBe(2);
    expect(sourceNames).toContain('FMHY');
    expect(sourceNames).toContain('NspGameHub');
  });

  it('should have all required fields populated on every entry', async () => {
    const { entries } = await scrapeAll([singlePassSource, deepLinkSource]);

    for (const entry of entries) {
      expect(entry.index).toBeGreaterThan(0);
      expect(entry.gameName).toBeTruthy();
      expect(entry.downloadUrl).toBeTruthy();
      expect(entry.downloadUrl).toMatch(/\.nsp$/i);
      expect(entry.sourceName).toBeTruthy();
      expect(entry.sourceUrl).toBeTruthy();
    }
  });

  it('should maintain sequential indices when deep-link source is processed first', async () => {
    // Reverse the order: deep-link first, then single-pass
    const { entries, errors } = await scrapeAll([deepLinkSource, singlePassSource]);

    expect(errors).toHaveLength(0);
    expect(entries).toHaveLength(5);

    // Indices should still be 1..5 regardless of source order
    const indices = entries.map((e) => e.index);
    expect(indices).toEqual([1, 2, 3, 4, 5]);

    // First 2 entries from deep-link, last 3 from single-pass
    expect(entries[0].sourceName).toBe('NspGameHub');
    expect(entries[1].sourceName).toBe('NspGameHub');
    expect(entries[2].sourceName).toBe('FMHY');
    expect(entries[3].sourceName).toBe('FMHY');
    expect(entries[4].sourceName).toBe('FMHY');
  });
});
