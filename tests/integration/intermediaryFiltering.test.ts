import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, FetchResult, DetailPageResult } from '../../src/types';

// Mock only the fetcher (HTTP layer) and progress — parsers, file host registry, and orchestrator run for real
vi.mock('../../src/fetcher');
vi.mock('../../src/progress');

import { fetchSource, fetchDetailPages } from '../../src/fetcher';
import { scrapeAll } from '../../src/orchestrator';

const mockedFetchSource = vi.mocked(fetchSource);
const mockedFetchDetailPages = vi.mocked(fetchDetailPages);

/** Ziperto source matching the real config */
const zipertoSource: Source = {
  url: 'https://www.ziperto.com/nintendo-switch-nsp/',
  name: 'Ziperto',
  requiresJs: true,
};

/**
 * Catalog page with a single game link so we can focus on detail page filtering.
 */
const catalogPageHtml = `<!DOCTYPE html>
<html>
<head><title>Nintendo Switch NSP - Ziperto</title></head>
<body>
<div id="main" class="site-main">
  <article class="post">
    <h2 class="entry-title">
      <a href="https://www.ziperto.com/pokemon-scarlet/">Pokemon Scarlet</a>
    </h2>
  </article>
</div>
</body>
</html>`;

/**
 * Detail page HTML containing a mix of:
 * - File host URLs (mega.nz, 1fichier.com, mediafire.com) — should be INCLUDED
 * - Intermediary URLs (bit.ly, adf.ly, ouo.io, linkvertise.com) — should be EXCLUDED
 * - Unknown/unrecognized URLs (example.com, randomsite.org) — should be EXCLUDED
 */
const detailPageHtml = `<!DOCTYPE html>
<html>
<head><title>Pokemon Scarlet - Ziperto</title></head>
<body>
<article>
  <h1 class="entry-title">Pokemon Scarlet</h1>
  <div class="entry-content">
    <p>Download links:</p>

    <!-- File host URLs (should be included) -->
    <a href="https://mega.nz/file/pokemon-scarlet">Mega Download</a>
    <a href="https://1fichier.com/?pokemon-scarlet">1fichier Download</a>
    <a href="https://mediafire.com/file/pokemon-scarlet">MediaFire Download</a>

    <!-- Intermediary URLs (should be excluded) -->
    <a href="https://bit.ly/pokemon-scarlet-dl">Shortened Link</a>
    <a href="https://adf.ly/pokemon-scarlet">Ad Gate 1</a>
    <a href="https://ouo.io/pokemon-scarlet">Ad Gate 2</a>
    <a href="https://linkvertise.com/pokemon-scarlet">Ad Gate 3</a>

    <!-- Unknown/unrecognized URLs (should be excluded) -->
    <a href="https://example.com/pokemon-scarlet">Example Site</a>
    <a href="https://randomsite.org/download/pokemon-scarlet">Random Site</a>
  </div>
</article>
</body>
</html>`;

describe('Integration: Intermediary Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFetchSource.mockImplementation(async (s: Source): Promise<FetchResult> => {
      if (s.name === 'Ziperto') {
        return { source: s, html: catalogPageHtml, error: null };
      }
      return { source: s, html: null, error: `Unknown source: ${s.name}` };
    });

    mockedFetchDetailPages.mockImplementation(async (gameLinks) => {
      return gameLinks.map((gl) => ({
        gameLink: gl,
        html: detailPageHtml,
        error: null,
      } as DetailPageResult));
    });
  });

  it('should include only file host URLs in downloadLinks, excluding intermediaries and unknown URLs', async () => {
    const { entries, errors } = await scrapeAll([zipertoSource]);

    expect(errors).toHaveLength(0);
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry.gameName).toBe('Pokemon Scarlet');
    expect(entry.downloadLinks).toBeDefined();
    expect(entry.downloadLinks!.length).toBe(3);

    const urls = entry.downloadLinks!.map((dl) => dl.url);

    // File host URLs should be present
    expect(urls).toContain('https://mega.nz/file/pokemon-scarlet');
    expect(urls).toContain('https://1fichier.com/?pokemon-scarlet');
    expect(urls).toContain('https://mediafire.com/file/pokemon-scarlet');
  });

  it('should exclude intermediary URLs (bit.ly, adf.ly, ouo.io, linkvertise.com)', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    const entry = entries[0];
    const urls = entry.downloadLinks!.map((dl) => dl.url);

    // Intermediary URLs must NOT appear
    expect(urls).not.toContain('https://bit.ly/pokemon-scarlet-dl');
    expect(urls).not.toContain('https://adf.ly/pokemon-scarlet');
    expect(urls).not.toContain('https://ouo.io/pokemon-scarlet');
    expect(urls).not.toContain('https://linkvertise.com/pokemon-scarlet');
  });

  it('should exclude unknown/unrecognized URLs', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    const entry = entries[0];
    const urls = entry.downloadLinks!.map((dl) => dl.url);

    // Unknown URLs must NOT appear
    expect(urls).not.toContain('https://example.com/pokemon-scarlet');
    expect(urls).not.toContain('https://randomsite.org/download/pokemon-scarlet');
  });

  it('should assign the correct hostName to each download link', async () => {
    const { entries } = await scrapeAll([zipertoSource]);

    const entry = entries[0];
    const hostMap = new Map(entry.downloadLinks!.map((dl) => [dl.url, dl.hostName]));

    expect(hostMap.get('https://mega.nz/file/pokemon-scarlet')).toBe('Mega');
    expect(hostMap.get('https://1fichier.com/?pokemon-scarlet')).toBe('1fichier');
    expect(hostMap.get('https://mediafire.com/file/pokemon-scarlet')).toBe('MediaFire');
  });
});
