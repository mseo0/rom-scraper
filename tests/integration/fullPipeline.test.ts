import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchResult } from '../../src/types';
import { TARGET_SOURCES } from '../../src/sources';
import { formatResults } from '../../src/formatter';

// Mock only the fetcher — parsers, formatter, and orchestrator run for real
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetch = vi.mocked(fetchSource);

/**
 * Build simple HTML containing .nsp links for a given source.
 * Each source gets unique game names and download URLs.
 */
const sourceHtml: Record<string, string> = {
  FMHY: `<html><body>
    <a href="https://dl.fmhy.com/zelda-totk.nsp">Zelda TOTK</a>
    <a href="https://dl.fmhy.com/mario-wonder.nsp">Mario Wonder</a>
  </body></html>`,

  RetrogradosGaming: `<html><body>
    <a href="https://retro.example.com/metroid-dread.nsp">Metroid Dread</a>
  </body></html>`,

  NSWTL: `<html><body>
    <a href="https://nswtl.example.com/pokemon-sv.nsp">Pokemon Scarlet</a>
  </body></html>`,

  Romenix: `<html><body>
    <a href="https://romenix.example.com/fire-emblem-engage.nsp">Fire Emblem Engage</a>
  </body></html>`,
};



describe('Full Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();


  });

  it('should scrape all sources, parse entries, assign indices, and format output', async () => {
    // Mock fetchSource to return predefined HTML for each source
    mockedFetch.mockImplementation(async (s) => {
      const html = sourceHtml[s.name];
      return { source: s, html: html ?? null, error: html ? null : `Unknown source: ${s.name}` } as FetchResult;
    });

    // Use only the single-pass sources that have mock HTML
    const singlePassSources = TARGET_SOURCES.filter((s) => s.name in sourceHtml);
    const { entries, errors } = await scrapeAll(singlePassSources);

    // All 4 single-pass sources succeed — no errors
    expect(errors).toHaveLength(0);

    // Total entries: FMHY(2) + Retrogrados(1) + NSWTL(1) + Romenix(1) = 5
    expect(entries).toHaveLength(5);

    // Verify all 4 sources are represented
    const sourceNames = new Set(entries.map((e) => e.sourceName));
    expect(sourceNames.size).toBe(4);
    expect(sourceNames).toContain('FMHY');
    expect(sourceNames).toContain('RetrogradosGaming');
    expect(sourceNames).toContain('NSWTL');
    expect(sourceNames).toContain('Romenix');

    // Verify sequential indices are assigned (1-based)
    entries.forEach((entry, i) => {
      expect(entry.index).toBe(i + 1);
    });

    // Verify GameEntry fields are populated correctly
    for (const entry of entries) {
      expect(entry.gameName).toBeTruthy();
      expect(entry.downloadUrl).toBeTruthy();
      expect(entry.downloadUrl).toMatch(/\.nsp$/i);
      expect(entry.sourceName).toBeTruthy();
      expect(entry.sourceUrl).toBeTruthy();
    }

    // Verify specific game names were extracted from link text
    const gameNames = entries.map((e) => e.gameName);
    expect(gameNames).toContain('Zelda TOTK');
    expect(gameNames).toContain('Metroid Dread');
    expect(gameNames).toContain('Pokemon Scarlet');
    expect(gameNames).toContain('Fire Emblem Engage');
  });

  it('should produce valid formatted output with summary and table', async () => {
    mockedFetch.mockImplementation(async (s) => {
      const html = sourceHtml[s.name];
      return { source: s, html: html ?? null, error: html ? null : `Unknown source: ${s.name}` } as FetchResult;
    });

    // Use only the single-pass sources that have mock HTML
    const singlePassSources = TARGET_SOURCES.filter((s) => s.name in sourceHtml);
    const { entries, errors } = await scrapeAll(singlePassSources);
    const output = formatResults(entries, errors);

    // Summary line shows correct total
    expect(output).toContain('Found 5 NSP links across 4 sources');

    // Per-source breakdown
    expect(output).toContain('FMHY: 2');
    expect(output).toContain('RetrogradosGaming: 1');
    expect(output).toContain('NSWTL: 1');
    expect(output).toContain('Romenix: 1');

    // Table contains game names
    expect(output).toContain('Zelda TOTK');
    expect(output).toContain('Metroid Dread');
    expect(output).toContain('Pokemon Scarlet');
    expect(output).toContain('Fire Emblem Engage');

    // Table contains download URLs
    expect(output).toContain('zelda-totk.nsp');
    expect(output).toContain('metroid-dread.nsp');

    // Table header
    expect(output).toContain('Game Name');
    expect(output).toContain('Source');
    expect(output).toContain('Download URL');

    // No errors section in output
    expect(output).not.toContain('Errors:');
  });

  it('should fetch all sources exactly once', async () => {
    mockedFetch.mockImplementation(async (s) => {
      const html = sourceHtml[s.name];
      return { source: s, html: html ?? null, error: html ? null : `Unknown source: ${s.name}` } as FetchResult;
    });

    // Use only the single-pass sources that have mock HTML
    const singlePassSources = TARGET_SOURCES.filter((s) => s.name in sourceHtml);
    await scrapeAll(singlePassSources);

    expect(mockedFetch).toHaveBeenCalledTimes(singlePassSources.length);

    // Verify each source was fetched
    const fetchedUrls = mockedFetch.mock.calls.map((call) => call[0].url);
    for (const source of singlePassSources) {
      expect(fetchedUrls).toContain(source.url);
    }
  });
});
