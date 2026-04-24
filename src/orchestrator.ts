import { Source, GameEntry, GameLink } from './types';
import { DownloadLink, filterDownloadLinks } from './fileHosts';
import { fetchSource, fetchDetailPages } from './fetcher';
import { parseSource, getSourceParser } from './parser';
import { getUltraNXToken } from './auth';
import axios from 'axios';
import { startSpinner, stopSpinner, reportComplete } from './progress';
import { validateLinks } from './validator';

export interface ScrapeOptions {
  validate?: boolean;
}

export async function scrapeAll(
  sources: Source[],
  searchQuery?: string | null,
  newReleases?: boolean,
  options?: ScrapeOptions
): Promise<{entries: GameEntry[], errors: string[]}> {
  const allEntries: GameEntry[] = [];
  const allErrors: string[] = [];
  let index = 1;

  for (const source of sources) {
    const sourceParser = getSourceParser(source.name);

    if (sourceParser) {
      // === Multi-layer pipeline ===

      // 1. Determine the URL to fetch based on mode
      let fetchUrl = source.url;
      if (newReleases) {
        if (!sourceParser.getNewReleasesUrl) {
          process.stdout.write(`  \x1b[2m${source.name} → does not support new releases\x1b[0m\n`);
          continue;
        }
        fetchUrl = sourceParser.getNewReleasesUrl(source.url);
      } else if (searchQuery && sourceParser.getSearchUrl) {
        fetchUrl = sourceParser.getSearchUrl(searchQuery, source.url);
      }
      const fetchSource_ = { ...source, url: fetchUrl };

      // 2. Fetch catalog/search page
      startSpinner(source.name, 'fetching catalog', source.requiresJs ? '(browser)' : undefined);
      const fetchResult = await fetchSource(fetchSource_);
      stopSpinner('✓', source.name, 'fetched catalog');
      if (fetchResult.error) {
        allErrors.push(fetchResult.error);
        continue;
      }

      // 2. Extract game links via SourceParser
      startSpinner(source.name, 'extracting game links');
      const gameLinks = sourceParser.extractGameLinks(fetchResult.html!, fetchUrl);
      stopSpinner('✓', source.name, 'extracted game links');

      // 3. Deduplicate game links by URL
      const seen = new Set<string>();
      const uniqueLinks: GameLink[] = [];
      for (const link of gameLinks) {
        if (!seen.has(link.url)) {
          seen.add(link.url);
          uniqueLinks.push(link);
        }
      }

      // 4. If no game links found, log and continue
      if (uniqueLinks.length === 0) {
        process.stdout.write(`  \x1b[2m${source.name} → no results\x1b[0m\n`);
        continue;
      }

      // 5. Fetch detail pages concurrently (concurrency limit = 5)
      startSpinner(source.name, `fetching ${uniqueLinks.length} detail pages`);
      const detailResults = await fetchDetailPages(uniqueLinks, source, 5);
      stopSpinner('✓', source.name, 'fetched detail pages');

      // 6. Collect errors from failed detail page fetches
      for (const result of detailResults) {
        if (result.error) {
          allErrors.push(result.error);
        }
      }

      // 7. Extract download links from successful detail pages
      startSpinner(source.name, 'extracting downloads');

      // For notUltraNX, get auth token before resolving download URLs
      let ultranxToken: string | null = null;
      if (source.name === 'notUltraNX') {
        ultranxToken = await getUltraNXToken();
        if (!ultranxToken) {
          stopSpinner('✓', source.name, 'extracted downloads');
          process.stdout.write(`  \x1b[33mnotUltraNX → skipped (login required)\x1b[0m\n`);
          continue;
        }
      }

      for (const result of detailResults) {
        if (result.html) {
          const extracted = sourceParser.extractDownloadLinks(result.html, result.gameLink.url);
          let downloadLinks = filterDownloadLinks(extracted.urls);

          // For notUltraNX, label each link with its pack type before resolving
          if (source.name === 'notUltraNX') {
            downloadLinks = downloadLinks.map((link) => ({
              url: link.url,
              hostName: labelFromApiUrl(link.url),
            }));
          }

          // Resolve notUltraNX download URLs to actual file URLs
          if (ultranxToken && downloadLinks.length > 0) {
            const resolved = await resolveUltraNXLinks(downloadLinks, ultranxToken);
            downloadLinks = resolved;
          }

          // Validate download links (unless --no-validate)
          if (options?.validate !== false && downloadLinks.length > 0) {
            startSpinner(source.name, `validating ${downloadLinks.length} links`);
            const liveLinks = await validateLinks(downloadLinks);
            const deadCount = downloadLinks.length - liveLinks.length;
            stopSpinner('✓', source.name, `validated: ${liveLinks.length} live, ${deadCount} dead`);
            downloadLinks = liveLinks;
          }

          if (downloadLinks.length > 0) {
            const entry: GameEntry = {
              index: index++,
              gameName: extracted.gameName,
              downloadLinks,
              downloadUrl: downloadLinks[0].url,
              sourceName: source.name,
              sourceUrl: source.url,
              detailPageUrl: result.gameLink.url,
            };
            allEntries.push(entry);
          }
        }
      }
      stopSpinner('✓', source.name, 'extracted downloads');
    } else {
      if (newReleases) {
        process.stdout.write(`  \x1b[2m${source.name} → does not support new releases\x1b[0m\n`);
        continue;
      }
      // === Single-pass pipeline (existing) ===

      // 1. Fetch the source
      startSpinner(source.name, 'fetching catalog');
      const fetchResult = await fetchSource(source);
      stopSpinner('✓', source.name, 'fetched catalog');

      // 2. If fetch failed, record error and continue
      if (fetchResult.error) {
        allErrors.push(fetchResult.error);
        continue;
      }

      // 3. Parse the HTML
      startSpinner(source.name, 'parsing');
      const parseResult = parseSource(source, fetchResult.html!);
      stopSpinner('✓', source.name, 'parsed');

      // 4. If message (no links found), log it
      if (parseResult.message) {
        process.stdout.write(`  \x1b[2m${parseResult.message}\x1b[0m\n`);
      }

      // 5. Add entries with sequential index
      for (const entry of parseResult.entries) {
        entry.index = index++;
        // Wrap downloadUrl into downloadLinks for backward compatibility
        if (!entry.downloadLinks || entry.downloadLinks.length === 0) {
          entry.downloadLinks = [{ url: entry.downloadUrl, hostName: 'Direct Download' }];
        }

        // Validate download links (unless --no-validate)
        if (options?.validate !== false && entry.downloadLinks.length > 0) {
          startSpinner(source.name, `validating ${entry.downloadLinks.length} links`);
          const liveLinks = await validateLinks(entry.downloadLinks);
          const deadCount = entry.downloadLinks.length - liveLinks.length;
          stopSpinner('✓', source.name, `validated: ${liveLinks.length} live, ${deadCount} dead`);
          entry.downloadLinks = liveLinks;
          if (liveLinks.length === 0) continue; // Skip entry if all links are dead
          entry.downloadUrl = liveLinks[0].url; // Update downloadUrl to first live link
        }

        allEntries.push(entry);
      }
    }
  }

  // Report completion
  reportComplete();

  return { entries: allEntries, errors: allErrors };
}


/**
 * Derive a pack label from a notUltraNX API download URL.
 * URLs: https://api.ultranx.ru/games/download/{titleId}/{type}
 */
function labelFromApiUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1]?.toLowerCase() || '';
    if (last === 'base') return 'Base Game';
    if (last === 'update') return 'Update';
    if (last === 'full') return 'Full Pack';
    return 'DLC';
  } catch {
    return 'Download';
  }
}

/**
 * Resolve notUltraNX API download URLs to actual file download URLs.
 * Preserves the hostName (pack label) from the original link.
 */
async function resolveUltraNXLinks(links: DownloadLink[], token: string): Promise<DownloadLink[]> {
  const resolved: DownloadLink[] = [];

  for (const link of links) {
    if (!link.url.includes('api.ultranx.ru')) {
      resolved.push(link);
      continue;
    }

    try {
      const response = await axios.get(link.url, {
        headers: { 'Cookie': `auth_token=${token}` },
        timeout: 15000,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      if (response.status >= 300 && response.headers.location) {
        resolved.push({ url: response.headers.location, hostName: link.hostName });
      } else {
        resolved.push(link);
      }
    } catch (err: any) {
      if (err?.response?.status >= 300 && err?.response?.headers?.location) {
        resolved.push({ url: err.response.headers.location, hostName: link.hostName });
      } else {
        resolved.push(link);
      }
    }
  }

  return resolved;
}
