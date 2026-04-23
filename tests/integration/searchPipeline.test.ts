import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchResult } from '../../src/types';
import { TARGET_SOURCES } from '../../src/sources';

// Mock only the fetcher and progress — parsers, formatter, orchestrator, and search run for real
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';
import { searchGames } from '../../src/search';
import { formatSearchResults } from '../../src/formatter';

const mockedFetch = vi.mocked(fetchSource);

/**
 * Predefined HTML for each source, reusing the same fixture data
 * as fullPipeline.test.ts so the integration surface is consistent.
 */
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
    <a href="https://switchrom.example.com/pikmin4.nsp">Pikmin 4</a>
  </body></html>`,

  NSWTL: `<html><body>
    <a href="https://nswtl.example.com/pokemon-sv.nsp">Pokemon Scarlet</a>
  </body></html>`,

  SwitchRomsOrg: `<html><body>
    <a href="https://switchroms.example.com/kirby-forgotten.nsp">Kirby Forgotten Land</a>
    <a href="https://switchroms.example.com/bayonetta3.nsp">Bayonetta 3</a>
    <a href="https://switchroms.example.com/mario-kart8.nsp">Mario Kart 8</a>
  </body></html>`,

  Romenix: `<html><body>
    <a href="https://romenix.example.com/fire-emblem-engage.nsp">Fire Emblem Engage</a>
  </body></html>`,
};

function setupFetchMock() {
  mockedFetch.mockImplementation(async (s) => {
    const html = sourceHtml[s.name];
    return {
      source: s,
      html: html ?? null,
      error: html ? null : `Unknown source: ${s.name}`,
    } as FetchResult;
  });
}

describe('Search Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter results to only matching entries for a search query', async () => {
    setupFetchMock();

    const { entries, errors } = await scrapeAll(TARGET_SOURCES);
    const filtered = searchGames('zelda', entries);
    const output = formatSearchResults(filtered, 'zelda', errors);

    // Should find exactly 1 match
    expect(filtered).toHaveLength(1);
    expect(output).toContain("Found 1 result(s) for 'zelda':");
    expect(output).toContain('Zelda TOTK');

    // Non-matching games must NOT appear
    expect(output).not.toContain('Metroid Dread');
    expect(output).not.toContain('Splatoon 3');
    expect(output).not.toContain('Pikmin 4');
    expect(output).not.toContain('Pokemon Scarlet');
    expect(output).not.toContain('Kirby Forgotten Land');
    expect(output).not.toContain('Bayonetta 3');
    expect(output).not.toContain('Fire Emblem Engage');
    expect(output).not.toContain('Mario Wonder');
    expect(output).not.toContain('Mario Kart 8');

    // Filtered entries should be re-indexed starting from 1
    filtered.forEach((entry, i) => {
      expect(entry.index).toBe(i + 1);
    });
  });

  it('should display no-match message when search has zero results', async () => {
    setupFetchMock();

    const { entries, errors } = await scrapeAll(TARGET_SOURCES);
    const filtered = searchGames('nonexistent', entries);
    const output = formatSearchResults(filtered, 'nonexistent', errors);

    expect(filtered).toHaveLength(0);
    expect(output).toContain("No games found matching 'nonexistent'.");
  });

  it('should include multiple matches across different sources', async () => {
    setupFetchMock();

    const { entries, errors } = await scrapeAll(TARGET_SOURCES);
    const filtered = searchGames('mario', entries);
    const output = formatSearchResults(filtered, 'mario', errors);

    // "Mario Wonder" from FMHY and "Mario Kart 8" from SwitchRomsOrg
    expect(filtered).toHaveLength(2);
    expect(output).toContain("Found 2 result(s) for 'mario':");
    expect(output).toContain('Mario Wonder');
    expect(output).toContain('Mario Kart 8');

    // Verify entries come from different sources
    const sourceNames = filtered.map((e) => e.sourceName);
    expect(sourceNames).toContain('FMHY');
    expect(sourceNames).toContain('SwitchRomsOrg');

    // Re-indexed sequentially
    expect(filtered[0].index).toBe(1);
    expect(filtered[1].index).toBe(2);
  });
});
