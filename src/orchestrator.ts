import { Source, GameEntry, GameLink } from './types';
import { DownloadLink, filterDownloadLinks } from './fileHosts';
import { fetchSource, fetchDetailPages } from './fetcher';
import { parseSource, getDeepLinkParser, getSourceParser } from './parser';
import { getUltraNXToken } from './auth';
import axios from 'axios';
import {
  reportFetching,
  reportParsing,
  reportComplete,
  reportExtractingLinks,
  reportFetchingDetails,
  reportExtractingDownloads,
} from './progress';

export async function scrapeAll(sources: Source[], searchQuery?: string | null): Promise<{entries: GameEntry[], errors: string[]}> {
  const allEntries: GameEntry[] = [];
  const allErrors: string[] = [];
  let index = 1;

  for (const source of sources) {
    const sourceParser = getSourceParser(source.name);

    if (sourceParser) {
      // === Multi-layer pipeline ===

      // 1. Determine the URL to fetch: search URL if query provided, otherwise catalog URL
      let fetchUrl = source.url;
      if (searchQuery && sourceParser.getSearchUrl) {
        fetchUrl = sourceParser.getSearchUrl(searchQuery, source.url);
      }
      const fetchSource_ = { ...source, url: fetchUrl };

      // 2. Fetch catalog/search page
      reportFetching(fetchSource_);
      const fetchResult = await fetchSource(fetchSource_);
      if (fetchResult.error) {
        allErrors.push(fetchResult.error);
        continue;
      }

      // 2. Extract game links via SourceParser
      reportExtractingLinks(source);
      const gameLinks = sourceParser.extractGameLinks(fetchResult.html!, fetchUrl);

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
      reportFetchingDetails(source, uniqueLinks.length);
      const detailResults = await fetchDetailPages(uniqueLinks, source, 5);

      // 6. Collect errors from failed detail page fetches
      for (const result of detailResults) {
        if (result.error) {
          allErrors.push(result.error);
        }
      }

      // 7. Extract download links from successful detail pages
      reportExtractingDownloads(source);

      // For notUltraNX, get auth token before resolving download URLs
      let ultranxToken: string | null = null;
      if (source.name === 'notUltraNX') {
        ultranxToken = await getUltraNXToken();
        if (!ultranxToken) {
          process.stdout.write(`  \x1b[33mnotUltraNX → skipped (login required)\x1b[0m\n`);
          continue;
        }
      }

      for (const result of detailResults) {
        if (result.html) {
          const extracted = sourceParser.extractDownloadLinks(result.html, result.gameLink.url);
          let downloadLinks = filterDownloadLinks(extracted.urls);

          // Resolve notUltraNX download URLs to actual file URLs
          if (ultranxToken && downloadLinks.length > 0) {
            const resolved = await resolveUltraNXLinks(downloadLinks, ultranxToken);
            downloadLinks = resolved;
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
    } else if (source.deepLink) {
      // === Legacy deep-link pipeline (existing) ===

      // 1. Fetch listing page
      reportFetching(source);
      const fetchResult = await fetchSource(source);
      if (fetchResult.error) {
        allErrors.push(fetchResult.error);
        continue;
      }

      // 2. Get deep link parser
      const parser = getDeepLinkParser(source.name);
      if (!parser) {
        const msg = `No deep link parser for ${source.name}`;
        process.stdout.write(`  \x1b[2m${msg}\x1b[0m\n`);
        allErrors.push(msg);
        continue;
      }

      // 3. Extract game links from listing page
      reportExtractingLinks(source);
      const gameLinks = parser.extractGameLinks(fetchResult.html!, source.url);

      // 4. Deduplicate game links by URL
      const seen = new Set<string>();
      const uniqueLinks: GameLink[] = [];
      for (const link of gameLinks) {
        if (!seen.has(link.url)) {
          seen.add(link.url);
          uniqueLinks.push(link);
        }
      }

      // 5. If no game links found, log and continue
      if (uniqueLinks.length === 0) {
        process.stdout.write(`  \x1b[2m${source.name} → no game links\x1b[0m\n`);
        continue;
      }

      // 6. Fetch detail pages concurrently
      reportFetchingDetails(source, uniqueLinks.length);
      const detailResults = await fetchDetailPages(uniqueLinks, source, 5);

      // 7. Collect errors from failed detail page fetches
      for (const result of detailResults) {
        if (result.error) {
          allErrors.push(result.error);
        }
      }

      // 8. Extract download entries from successful detail pages
      reportExtractingDownloads(source);
      for (const result of detailResults) {
        if (result.html) {
          const entry = parser.extractDownloadEntry(result.html, result.gameLink, source);
          if (entry) {
            entry.index = index++;
            // Wrap downloadUrl into downloadLinks for backward compatibility
            if (!entry.downloadLinks || entry.downloadLinks.length === 0) {
              entry.downloadLinks = [{ url: entry.downloadUrl, hostName: 'Direct Download' }];
            }
            allEntries.push(entry);
          }
        }
      }
    } else {
      // === Single-pass pipeline (existing) ===

      // 1. Report fetching progress
      reportFetching(source);

      // 2. Fetch the source
      const fetchResult = await fetchSource(source);

      // 3. If fetch failed, record error and continue
      if (fetchResult.error) {
        allErrors.push(fetchResult.error);
        continue;
      }

      // 4. Report parsing progress
      reportParsing(source);

      // 5. Parse the HTML
      const parseResult = parseSource(source, fetchResult.html!);

      // 6. If message (no links found), log it
      if (parseResult.message) {
        process.stdout.write(`  \x1b[2m${parseResult.message}\x1b[0m\n`);
      }

      // 7. Add entries with sequential index
      for (const entry of parseResult.entries) {
        entry.index = index++;
        // Wrap downloadUrl into downloadLinks for backward compatibility
        if (!entry.downloadLinks || entry.downloadLinks.length === 0) {
          entry.downloadLinks = [{ url: entry.downloadUrl, hostName: 'Direct Download' }];
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
 * Resolve notUltraNX API download URLs to actual file download URLs.
 * The API uses an auth_token cookie for download authentication.
 * It returns a redirect (302) to the real file URL when given a valid token.
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

      // If we get a redirect, use the Location header as the real download URL
      if (response.status >= 300 && response.headers.location) {
        resolved.push({ url: response.headers.location, hostName: 'Direct Download' });
      } else {
        // API returned content directly — keep original URL
        resolved.push(link);
      }
    } catch (err: any) {
      // Axios throws on 3xx when maxRedirects=0, check for redirect
      if (err?.response?.status >= 300 && err?.response?.headers?.location) {
        resolved.push({ url: err.response.headers.location, hostName: 'Direct Download' });
      } else {
        // Resolution failed — keep original URL
        resolved.push(link);
      }
    }
  }

  return resolved;
}
