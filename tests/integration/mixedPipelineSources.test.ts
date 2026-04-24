import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, FetchResult, DetailPageResult } from '../../src/types';

// Mock only the fetcher (HTTP layer) and progress — parsers, file host registry, and orchestrator run for real
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** Single-pass source (FMHY) — listing HTML has direct .nsp links */
const singlePassSource: Source = {
  url: 'https://fmhy.net/gamingpiracyguide#nintendo-roms',
  name: 'FMHY',
  requiresJs: false,
};

/** Multi-layer source (Ziperto) — uses real Ziperto parser */
const multiLayerSource: Source = {
  url: 'https://www.ziperto.com/nintendo-switch-nsp/',
  name: 'Ziperto',
  requiresJs: true,
};

/** Single-pass listing page with direct .nsp download links */
const singlePassHtml = `<html><body>
  <a href="https://dl.fmhy.com/zelda-totk.nsp">Zelda TOTK</a>
  <a href="https://dl.fmhy.com/mario-wonder.nsp">Mario Wonder</a>
</body></html>`;

/**
 * Realistic Ziperto catalog page HTML that the real Ziperto parser can parse.
 * Uses `.entry-title a` links pointing to detail pages on the same domain.
 */
const zipertoCatalogHtml = `<!DOCTYPE html>
<html>
<head><title>Nintendo Switch NSP - Ziperto</title></head>
<body>
<div id="main" class="site-main">
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/metroid-dread/">Metroid Dread</a>
    </h2>
  </article>
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/fire-emblem-engage/">Fire Emblem Engage</a>
    </h2>
  </article>
</div>
</body>
</html>`;

/** Ziperto detail page HTML for each game with file host links */
const zipertoDetailPages: Record<string, string> = {
  'https://www.ziperto.com/metroid-dread/': `<!DOCTYPE html>
<html>
<head><title>Metroid Dread - Ziperto</title></head>
<body>
<article>
  <h1 class="entry-title">Metroid Dread</h1>
  <div class="entry-content">
    <p>Download links:</p>
    <a href="https://mega.nz/file/metroid-dread">Mega</a>
    <a href="https://1fichier.com/?metroid-dread">1fichier</a>
  </div>
</article>
</body>
</html>`,

  'https://www.ziperto.com/fire-emblem-engage/': `<!DOCTYPE html>
<html>
<head><title>Fire Emblem Engage - Ziperto</title></head>
<body>
<article>
  <h1 class="entry-title">Fire Emblem Engage</h1>
  <div class="entry-content">
    <p>Download links:</p>
    <a href="https://gofile.io/d/fire-emblem">Gofile</a>
    <a href="https://mediafire.com/file/fire-emblem-engage">MediaFire</a>
    <a href="https://buzzheavier.com/fire-emblem-engage">Buzzheavier</a>
  </div>
</article>
</body>
</html>`,
};

describe('Mixed Pipeline Sources Integration (Single-Pass + Multi-Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetchSource to return appropriate HTML for each source
    mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
      if (s.name === 'FMHY') {
        return { source: s, html: singlePassHtml, error: null };
      }
      if (s.name === 'Ziperto') {
        return { source: s, html: zipertoCatalogHtml, error: null };
      }
      return { source: s, html: null, error: `Unknown source: ${s.name}` };
    });

    // Mock fetchDetailPages to return detail page HTML for Ziperto game links
    mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
      return gameLinks.map((gl) => {
        const html = zipertoDetailPages[gl.url] ?? null;
        return {
          gameLink: gl,
          html,
          error: html ? null : `Failed to fetch ${gl.url}`,
        } as DetailPageResult;
      });
    });
  });

  it('should produce entries from both sources with sequential indices 1..N', async () => {
    const { entries, errors } = await scrapeAll([singlePassSource, multiLayerSource]);

    expect(errors).toHaveLength(0);

    // Total: 2 single-pass (FMHY) + 2 multi-layer (Ziperto) = 4 entries
    expect(entries).toHaveLength(4);

    // Verify sequential indices: 1, 2, 3, 4 — contiguous, no gaps
    const indices = entries.map((e) => e.index);
    expect(indices).toEqual([1, 2, 3, 4]);
  });

  it('should have correct sourceName for each entry', async () => {
    const { entries } = await scrapeAll([singlePassSource, multiLayerSource]);

    const sourceNames = new Set(entries.map((e) => e.sourceName));
    expect(sourceNames.size).toBe(2);
    expect(sourceNames).toContain('FMHY');
    expect(sourceNames).toContain('Ziperto');

    // FMHY entries come first (processed first), then Ziperto
    const fmhyEntries = entries.filter((e) => e.sourceName === 'FMHY');
    const zipertoEntries = entries.filter((e) => e.sourceName === 'Ziperto');
    expect(fmhyEntries).toHaveLength(2);
    expect(zipertoEntries).toHaveLength(2);
  });

  it('should wrap single-pass entries with "Direct Download" downloadLinks', async () => {
    const { entries } = await scrapeAll([singlePassSource, multiLayerSource]);

    const fmhyEntries = entries.filter((e) => e.sourceName === 'FMHY');
    expect(fmhyEntries).toHaveLength(2);

    for (const entry of fmhyEntries) {
      expect(entry.downloadLinks).toBeDefined();
      expect(entry.downloadLinks!.length).toBe(1);
      expect(entry.downloadLinks![0].hostName).toBe('Direct Download');
      expect(entry.downloadLinks![0].url).toBe(entry.downloadUrl);
    }
  });

  it('should populate multi-layer entries with file host downloadLinks', async () => {
    const { entries } = await scrapeAll([singlePassSource, multiLayerSource]);

    const zipertoEntries = entries.filter((e) => e.sourceName === 'Ziperto');
    expect(zipertoEntries).toHaveLength(2);

    for (const entry of zipertoEntries) {
      expect(entry.downloadLinks).toBeDefined();
      expect(entry.downloadLinks!.length).toBeGreaterThan(0);

      // Each download link should have a recognized file host name (not "Direct Download")
      for (const dl of entry.downloadLinks!) {
        expect(dl.url).toBeTruthy();
        expect(dl.hostName).toBeTruthy();
        expect(dl.hostName).not.toBe('Direct Download');
      }
    }

    // Metroid Dread: Mega, 1fichier
    const metroid = zipertoEntries.find((e) => e.gameName.includes('Metroid'))!;
    const metroidHosts = metroid.downloadLinks!.map((dl) => dl.hostName);
    expect(metroidHosts).toContain('Mega');
    expect(metroidHosts).toContain('1fichier');

    // Fire Emblem Engage: Gofile, MediaFire, Buzzheavier
    const fireEmblem = zipertoEntries.find((e) => e.gameName.includes('Fire Emblem'))!;
    const feHosts = fireEmblem.downloadLinks!.map((dl) => dl.hostName);
    expect(feHosts).toContain('Gofile');
    expect(feHosts).toContain('MediaFire');
    expect(feHosts).toContain('Buzzheavier');
  });

  it('should maintain sequential indices when multi-layer source is processed first', async () => {
    // Reverse the order: multi-layer first, then single-pass
    const { entries, errors } = await scrapeAll([multiLayerSource, singlePassSource]);

    expect(errors).toHaveLength(0);
    expect(entries).toHaveLength(4);

    // Indices should still be 1..4 regardless of source order
    const indices = entries.map((e) => e.index);
    expect(indices).toEqual([1, 2, 3, 4]);

    // First 2 entries from Ziperto, last 2 from FMHY
    expect(entries[0].sourceName).toBe('Ziperto');
    expect(entries[1].sourceName).toBe('Ziperto');
    expect(entries[2].sourceName).toBe('FMHY');
    expect(entries[3].sourceName).toBe('FMHY');
  });

  it('should have all required fields populated on every entry', async () => {
    const { entries } = await scrapeAll([singlePassSource, multiLayerSource]);

    for (const entry of entries) {
      expect(entry.index).toBeGreaterThan(0);
      expect(entry.gameName).toBeTruthy();
      expect(entry.downloadUrl).toBeTruthy();
      expect(entry.sourceName).toBeTruthy();
      expect(entry.sourceUrl).toBeTruthy();
      expect(entry.downloadLinks).toBeDefined();
      expect(entry.downloadLinks!.length).toBeGreaterThan(0);
    }
  });
});
