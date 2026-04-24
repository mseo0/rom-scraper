import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, FetchResult, DetailPageResult } from '../../src/types';

// Mock only the fetcher (HTTP layer) and progress — parsers, file host registry, and orchestrator run for real
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** Ziperto source matching the real config in src/sources.ts */
const zipertoSource: Source = {
  url: 'https://www.ziperto.com/nintendo-switch-nsp/',
  name: 'Ziperto',
  requiresJs: true,
};

/**
 * Realistic WordPress-style catalog page HTML that the Ziperto parser can parse.
 * Uses `.entry-title a` links pointing to detail pages on the same domain.
 */
const catalogPageHtml = `<!DOCTYPE html>
<html>
<head><title>Nintendo Switch NSP - Ziperto</title></head>
<body>
<div id="main" class="site-main">
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/the-legend-of-zelda-totk/">The Legend of Zelda: Tears of the Kingdom</a>
    </h2>
  </article>
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/super-mario-bros-wonder/">Super Mario Bros. Wonder</a>
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

/**
 * Realistic WordPress-style detail page HTML for each game.
 * Each has an h1.entry-title for the game name and external file host links
 * inside .entry-content pointing to recognized file hosts.
 */
const detailPages: Record<string, string> = {
  'https://www.ziperto.com/the-legend-of-zelda-totk/': `<!DOCTYPE html>
<html>
<head><title>The Legend of Zelda: Tears of the Kingdom - Ziperto</title></head>
<body>
<article>
  <h1 class="entry-title">The Legend of Zelda: Tears of the Kingdom</h1>
  <div class="entry-content">
    <p>Download links:</p>
    <a href="https://mega.nz/file/abc123">Mega</a>
    <a href="https://1fichier.com/?zelda-totk">1fichier</a>
    <a href="https://mediafire.com/file/zelda-totk">MediaFire</a>
  </div>
</article>
</body>
</html>`,

  'https://www.ziperto.com/super-mario-bros-wonder/': `<!DOCTYPE html>
<html>
<head><title>Super Mario Bros. Wonder - Ziperto</title></head>
<body>
<article>
  <h1 class="entry-title">Super Mario Bros. Wonder</h1>
  <div class="entry-content">
    <p>Download links:</p>
    <a href="https://mega.nz/file/mario-wonder">Mega</a>
    <a href="https://1fichier.com/?mario-wonder">1fichier</a>
    <a href="https://bit.ly/fake-shortener">Shortened Link</a>
    <a href="https://unknown-site.com/mario">Some Random Site</a>
  </div>
</article>
</body>
</html>`,

  'https://www.ziperto.com/metroid-dread/': `<!DOCTYPE html>
<html>
<head><title>Metroid Dread - Ziperto</title></head>
<body>
<article>
  <h1 class="entry-title">Metroid Dread</h1>
  <div class="entry-content">
    <p>Download links:</p>
    <a href="https://gofile.io/d/metroid-dread">Gofile</a>
    <a href="https://buzzheavier.com/metroid-dread">Buzzheavier</a>
  </div>
</article>
</body>
</html>`,
};

describe('Multi-Layer Pipeline Integration (Ziperto end-to-end)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetchSource to return catalog page HTML for Ziperto
    mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
      if (s.name === 'Ziperto') {
        return { source: s, html: catalogPageHtml, error: null };
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

  it('should produce GameEntry records with correct gameName from detail pages', async () => {
    const { entries, errors } = await scrapeAll([zipertoSource]);

    expect(errors).toHaveLength(0);
    expect(entries).toHaveLength(3);

    const gameNames = entries.map((e) => e.gameName);
    expect(gameNames).toContain('The Legend of Zelda: Tears of the Kingdom');
    expect(gameNames).toContain('Super Mario Bros. Wonder');
    expect(gameNames).toContain('Metroid Dread');
  });

  it('should populate downloadLinks with correct hostName values from file host registry', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    // Zelda entry: Mega, 1fichier, MediaFire
    const zelda = entries.find((e) => e.gameName.includes('Zelda'))!;
    expect(zelda.downloadLinks).toBeDefined();
    expect(zelda.downloadLinks!.length).toBe(3);
    const zeldaHosts = zelda.downloadLinks!.map((dl) => dl.hostName);
    expect(zeldaHosts).toContain('Mega');
    expect(zeldaHosts).toContain('1fichier');
    expect(zeldaHosts).toContain('MediaFire');

    // Mario entry: Mega, 1fichier (intermediary bit.ly and unknown site excluded)
    const mario = entries.find((e) => e.gameName.includes('Mario'))!;
    expect(mario.downloadLinks).toBeDefined();
    expect(mario.downloadLinks!.length).toBe(2);
    const marioHosts = mario.downloadLinks!.map((dl) => dl.hostName);
    expect(marioHosts).toContain('Mega');
    expect(marioHosts).toContain('1fichier');
    // Intermediary and unknown URLs should NOT be present
    expect(marioHosts).not.toContain('bit.ly');

    // Metroid entry: Gofile, Buzzheavier
    const metroid = entries.find((e) => e.gameName.includes('Metroid'))!;
    expect(metroid.downloadLinks).toBeDefined();
    expect(metroid.downloadLinks!.length).toBe(2);
    const metroidHosts = metroid.downloadLinks!.map((dl) => dl.hostName);
    expect(metroidHosts).toContain('Gofile');
    expect(metroidHosts).toContain('Buzzheavier');
  });

  it('should set detailPageUrl on each entry', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    for (const entry of entries) {
      expect(entry.detailPageUrl).toBeTruthy();
      expect(entry.detailPageUrl).toMatch(/^https:\/\/www\.ziperto\.com\//);
    }

    const detailUrls = entries.map((e) => e.detailPageUrl);
    expect(detailUrls).toContain('https://www.ziperto.com/the-legend-of-zelda-totk/');
    expect(detailUrls).toContain('https://www.ziperto.com/super-mario-bros-wonder/');
    expect(detailUrls).toContain('https://www.ziperto.com/metroid-dread/');
  });

  it('should assign sequential indices starting from 1', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    expect(entries).toHaveLength(3);
    entries.forEach((entry, i) => {
      expect(entry.index).toBe(i + 1);
    });
  });

  it('should set sourceName to Ziperto on all entries', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    for (const entry of entries) {
      expect(entry.sourceName).toBe('Ziperto');
      expect(entry.sourceUrl).toBe('https://www.ziperto.com/nintendo-switch-nsp/');
    }
  });

  it('should set downloadUrl to the first download link URL for backward compatibility', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    for (const entry of entries) {
      expect(entry.downloadUrl).toBeTruthy();
      expect(entry.downloadUrl).toBe(entry.downloadLinks![0].url);
    }
  });
});
