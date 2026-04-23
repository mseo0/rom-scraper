import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchResult, Source, DetailPageResult } from '../../src/types';
import { TARGET_SOURCES } from '../../src/sources';
import { formatResults } from '../../src/formatter';

vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetch = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** HTML snippets that produce valid .nsp entries when parsed */
const sourceHtml: Record<string, string> = {
  FMHY: `<html><body>
    <a href="https://dl.fmhy.com/zelda-totk.nsp">Zelda TOTK</a>
    <a href="https://dl.fmhy.com/mario-wonder.nsp">Mario Wonder</a>
  </body></html>`,
  RetrogradosGaming: `<html><body>
    <a href="https://retro.example.com/metroid-dread.nsp">Metroid Dread</a>
  </body></html>`,
  SwitchRom: `<html><body>
    <a href="https://switchrom.example.com/splatoon3.nsp">Splatoon 3</a>
  </body></html>`,
  NSWTL: `<html><body>
    <a href="https://nswtl.example.com/pokemon-sv.nsp">Pokemon Scarlet</a>
  </body></html>`,
  SwitchRomsOrg: `<html><body>
    <a href="https://switchroms.example.com/kirby-forgotten.nsp">Kirby Forgotten Land</a>
    <a href="https://switchroms.example.com/bayonetta3.nsp">Bayonetta 3</a>
  </body></html>`,
  Romenix: `<html><body>
    <a href="https://romenix.example.com/fire-emblem-engage.nsp">Fire Emblem Engage</a>
  </body></html>`,

  NspGameHub: `<html><body>
    <a href="https://nspgamehub.com/game/astral-chain">Astral Chain</a>
  </body></html>`,
};

/** Detail page HTML for NspGameHub deep-link source */
const nspGameHubDetailPages: Record<string, string> = {
  'https://nspgamehub.com/game/astral-chain': `<html><head><title>Astral Chain</title></head><body>
    <h1>Astral Chain</h1>
    <a href="https://dl.nspgamehub.com/astral-chain.nsp">Download</a>
  </body></html>`,
};

/** Names of sources that should fail in the "2 fail, 4 succeed" scenario */
const failingSources = new Set(['FMHY', 'SwitchRom']);

function buildMock(failSet: Set<string>) {
  return async (s: Source): Promise<FetchResult> => {
    if (failSet.has(s.name)) {
      // Simulate HTTP 500 for FMHY, connection timeout for SwitchRom
      const error =
        s.name === 'FMHY'
          ? `HTTP error 500 fetching ${s.url}`
          : `Request timed out fetching ${s.url}`;
      return { source: s, html: null, error };
    }
    return { source: s, html: sourceHtml[s.name], error: null };
  };
}

describe('Partial Source Failure Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetchDetailPages for the NspGameHub deep-link source
    mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
      return gameLinks.map((gl) => {
        const html = nspGameHubDetailPages[gl.url] ?? null;
        return {
          gameLink: gl,
          html,
          error: html ? null : `Failed to fetch ${gl.url}`,
        } as DetailPageResult;
      });
    });
  });

  describe('2 sources fail, 4 succeed', () => {
    beforeEach(() => {
      mockedFetch.mockImplementation(buildMock(failingSources));
    });

    it('should collect entries from successful sources and record errors from failed ones', async () => {
      const { entries, errors } = await scrapeAll(TARGET_SOURCES);

      // 2 errors: one HTTP 500, one timeout
      expect(errors).toHaveLength(2);
      expect(errors.some((e) => e.includes('HTTP error 500'))).toBe(true);
      expect(errors.some((e) => e.includes('timed out'))).toBe(true);

      // Successful sources: RetrogradosGaming(1) + NSWTL(1) + SwitchRomsOrg(2) + Romenix(1) + NspGameHub(1) = 6
      expect(entries).toHaveLength(6);

      // No entries from failed sources
      const sourceNames = new Set(entries.map((e) => e.sourceName));
      expect(sourceNames).not.toContain('FMHY');
      expect(sourceNames).not.toContain('SwitchRom');

      // Sequential indices are 1-based and contiguous (only counting successful entries)
      entries.forEach((entry, i) => {
        expect(entry.index).toBe(i + 1);
      });
    });

    it('should produce formatted output with successful entries and error messages', async () => {
      const { entries, errors } = await scrapeAll(TARGET_SOURCES);
      const output = formatResults(entries, errors);

      // Summary counts only successful entries
      expect(output).toContain('Found 6 NSP links across 5 sources');

      // Contains entries from successful sources
      expect(output).toContain('Metroid Dread');
      expect(output).toContain('Pokemon Scarlet');
      expect(output).toContain('Kirby Forgotten Land');
      expect(output).toContain('Fire Emblem Engage');

      // Does NOT contain entries from failed sources
      expect(output).not.toContain('Zelda TOTK');
      expect(output).not.toContain('Splatoon 3');

      // Error section is present
      expect(output).toContain('Errors:');
      expect(output).toContain('HTTP error 500');
      expect(output).toContain('timed out');
    });
  });

  describe('all sources fail', () => {
    it('should return no entries and record all errors', async () => {
      mockedFetch.mockImplementation(async (s: Source): Promise<FetchResult> => {
        return { source: s, html: null, error: `HTTP error 500 fetching ${s.url}` };
      });

      const { entries, errors } = await scrapeAll(TARGET_SOURCES);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(7);

      const output = formatResults(entries, errors);
      expect(output).toContain('No .nsp files were found on any source.');
      expect(output).toContain('Errors:');
      errors.forEach((err) => {
        expect(output).toContain(err);
      });
    });
  });

  describe('only 1 source succeeds', () => {
    it('should collect entries from the single successful source', async () => {
      // Only Romenix succeeds
      const failAll = new Set(
        TARGET_SOURCES.filter((s) => s.name !== 'Romenix').map((s) => s.name),
      );
      mockedFetch.mockImplementation(async (s: Source): Promise<FetchResult> => {
        if (failAll.has(s.name)) {
          return { source: s, html: null, error: `Connection failed fetching ${s.url}: ECONNREFUSED` };
        }
        return { source: s, html: sourceHtml[s.name], error: null };
      });

      const { entries, errors } = await scrapeAll(TARGET_SOURCES);

      // 6 sources failed
      expect(errors).toHaveLength(6);

      // Only Romenix entry
      expect(entries).toHaveLength(1);
      expect(entries[0].sourceName).toBe('Romenix');
      expect(entries[0].gameName).toBe('Fire Emblem Engage');
      expect(entries[0].index).toBe(1);

      const output = formatResults(entries, errors);
      expect(output).toContain('Found 1 NSP links across 1 sources');
      expect(output).toContain('Fire Emblem Engage');
      expect(output).toContain('Errors:');
      expect(output).toContain('ECONNREFUSED');
    });
  });
});
