import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, FetchResult, DetailPageResult } from '../../src/types';
import { formatResults } from '../../src/formatter';

// Mock only the fetcher and progress — let real orchestrator, parsers, and formatter run
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** Deep-link source where all detail pages will fail */
const deepLinkSource: Source = {
  url: 'https://nspgamehub.com',
  name: 'NspGameHub',
  requiresJs: false,
  deepLink: true,
};

/** Single-pass source that succeeds normally */
const singlePassSource: Source = {
  url: 'https://fmhy.net/gamingpiracyguide#nintendo-roms',
  name: 'FMHY',
  requiresJs: false,
};

/** Listing page HTML for the deep-link source with 3 game links */
const deepLinkListingHtml = `<html><body>
  <a href="https://nspgamehub.com/game/zelda-totk">Zelda TOTK</a>
  <a href="https://nspgamehub.com/game/mario-wonder">Mario Wonder</a>
  <a href="https://nspgamehub.com/game/metroid-dread">Metroid Dread</a>
</body></html>`;

/** Single-pass listing page with direct .nsp download links */
const singlePassHtml = `<html><body>
  <a href="https://dl.fmhy.com/splatoon3.nsp">Splatoon 3</a>
  <a href="https://dl.fmhy.com/pikmin4.nsp">Pikmin 4</a>
</body></html>`;

/** Detail page HTML for partial failure scenario — only one game succeeds */
const partialDetailPages: Record<string, string> = {
  'https://nspgamehub.com/game/mario-wonder': `<html>
    <head><title>Super Mario Bros Wonder</title></head>
    <body>
      <h1>Super Mario Bros Wonder</h1>
      <a href="https://dl.nspgamehub.com/mario-wonder.nsp">Download NSP</a>
    </body>
  </html>`,
};

describe('Detail Page Failure Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('all detail pages fail for deep-link source, single-pass source succeeds', () => {
    beforeEach(() => {
      mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
        if (s.name === 'NspGameHub') {
          return { source: s, html: deepLinkListingHtml, error: null };
        }
        if (s.name === 'FMHY') {
          return { source: s, html: singlePassHtml, error: null };
        }
        return { source: s, html: null, error: `Unknown source: ${s.name}` };
      });

      // All detail page fetches fail for the deep-link source
      mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
        return gameLinks.map((gl) => ({
          gameLink: gl,
          html: null,
          error: `Request timed out fetching ${gl.url}`,
        } as DetailPageResult));
      });
    });

    it('should record all detail page errors and produce no entries from the deep-link source', async () => {
      const { entries, errors } = await scrapeAll([deepLinkSource, singlePassSource]);

      // 3 detail page errors from NspGameHub
      expect(errors).toHaveLength(3);
      expect(errors.every((e) => e.includes('timed out'))).toBe(true);
      expect(errors.some((e) => e.includes('zelda-totk'))).toBe(true);
      expect(errors.some((e) => e.includes('mario-wonder'))).toBe(true);
      expect(errors.some((e) => e.includes('metroid-dread'))).toBe(true);

      // No entries from NspGameHub
      const nspEntries = entries.filter((e) => e.sourceName === 'NspGameHub');
      expect(nspEntries).toHaveLength(0);

      // Entries from FMHY are present
      const fmhyEntries = entries.filter((e) => e.sourceName === 'FMHY');
      expect(fmhyEntries).toHaveLength(2);
    });

    it('should still process the next source and produce correct sequential indices', async () => {
      const { entries } = await scrapeAll([deepLinkSource, singlePassSource]);

      // Only FMHY entries, sequentially indexed from 1
      expect(entries).toHaveLength(2);
      expect(entries[0].index).toBe(1);
      expect(entries[1].index).toBe(2);
      expect(entries[0].sourceName).toBe('FMHY');
      expect(entries[1].sourceName).toBe('FMHY');
    });

    it('should include error messages in formatted output', async () => {
      const { entries, errors } = await scrapeAll([deepLinkSource, singlePassSource]);
      const output = formatResults(entries, errors);

      // Formatted output includes entries from FMHY
      expect(output).toContain('FMHY');

      // Error section is present with detail page errors
      expect(output).toContain('Errors:');
      expect(output).toContain('timed out');
      expect(output).toContain('zelda-totk');
      expect(output).toContain('mario-wonder');
      expect(output).toContain('metroid-dread');
    });
  });

  describe('all detail pages fail for deep-link source (only source)', () => {
    beforeEach(() => {
      mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
        if (s.name === 'NspGameHub') {
          return { source: s, html: deepLinkListingHtml, error: null };
        }
        return { source: s, html: null, error: `Unknown source: ${s.name}` };
      });

      mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
        return gameLinks.map((gl) => ({
          gameLink: gl,
          html: null,
          error: `HTTP error 500 fetching ${gl.url}`,
        } as DetailPageResult));
      });
    });

    it('should record all errors and return zero entries', async () => {
      const { entries, errors } = await scrapeAll([deepLinkSource]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(3);
      expect(errors.every((e) => e.includes('HTTP error 500'))).toBe(true);
    });

    it('should produce formatted output with no-results message and errors', async () => {
      const { entries, errors } = await scrapeAll([deepLinkSource]);
      const output = formatResults(entries, errors);

      expect(output).toContain('No .nsp files were found on any source.');
      expect(output).toContain('Errors:');
      errors.forEach((err) => {
        expect(output).toContain(err);
      });
    });
  });

  describe('partial detail page failures', () => {
    beforeEach(() => {
      mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
        if (s.name === 'NspGameHub') {
          return { source: s, html: deepLinkListingHtml, error: null };
        }
        return { source: s, html: null, error: `Unknown source: ${s.name}` };
      });

      // Only mario-wonder succeeds; zelda-totk and metroid-dread fail
      mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
        return gameLinks.map((gl) => {
          const html = partialDetailPages[gl.url] ?? null;
          return {
            gameLink: gl,
            html,
            error: html ? null : `Connection failed fetching ${gl.url}: ECONNREFUSED`,
          } as DetailPageResult;
        });
      });
    });

    it('should produce entries from successful detail pages and record errors from failed ones', async () => {
      const { entries, errors } = await scrapeAll([deepLinkSource]);

      // 2 detail pages failed
      expect(errors).toHaveLength(2);
      expect(errors.some((e) => e.includes('zelda-totk'))).toBe(true);
      expect(errors.some((e) => e.includes('metroid-dread'))).toBe(true);

      // 1 entry from the successful detail page
      expect(entries).toHaveLength(1);
      expect(entries[0].gameName).toBe('Super Mario Bros Wonder');
      expect(entries[0].downloadUrl).toBe('https://dl.nspgamehub.com/mario-wonder.nsp');
      expect(entries[0].sourceName).toBe('NspGameHub');
      expect(entries[0].detailPageUrl).toBe('https://nspgamehub.com/game/mario-wonder');
      expect(entries[0].index).toBe(1);
    });

    it('should include both errors and successful entries in formatted output', async () => {
      const { entries, errors } = await scrapeAll([deepLinkSource]);
      const output = formatResults(entries, errors);

      // Successful entry present
      expect(output).toContain('Super Mario Bros Wonder');
      expect(output).toContain('NspGameHub');

      // Errors present
      expect(output).toContain('Errors:');
      expect(output).toContain('ECONNREFUSED');
    });
  });
});
