import { Source, GameEntry, GameLink } from './types';
import { fetchSource, fetchDetailPages } from './fetcher';
import { parseSource, getDeepLinkParser } from './parser';
import {
  reportFetching,
  reportParsing,
  reportComplete,
  reportExtractingLinks,
  reportFetchingDetails,
  reportExtractingDownloads,
} from './progress';

export async function scrapeAll(sources: Source[]): Promise<{entries: GameEntry[], errors: string[]}> {
  const allEntries: GameEntry[] = [];
  const allErrors: string[] = [];
  let index = 1;

  for (const source of sources) {
    if (source.deepLink) {
      // === Deep link two-step pipeline ===

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
        console.log(msg);
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
        console.log(`No game links found on ${source.name}`);
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
            allEntries.push(entry);
          }
        }
      }
    } else {
      // === Existing single-pass pipeline (unchanged) ===

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
        console.log(parseResult.message);
      }

      // 7. Add entries with sequential index
      for (const entry of parseResult.entries) {
        entry.index = index++;
        allEntries.push(entry);
      }
    }
  }

  // Report completion
  reportComplete();

  return { entries: allEntries, errors: allErrors };
}
