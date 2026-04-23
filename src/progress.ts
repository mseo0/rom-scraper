import { Source } from './types';

export function reportFetching(source: Source): void {
  console.log(`Fetching ${source.name} (${source.url})...`);
}

export function reportParsing(source: Source): void {
  console.log(`Parsing ${source.name} for .nsp links...`);
}

export function reportComplete(): void {
  console.log('Scraping complete.');
}

export function reportExtractingLinks(source: Source): void {
  console.log(`Extracting game links from ${source.name}...`);
}

export function reportFetchingDetails(source: Source, count: number): void {
  console.log(`Fetching ${count} detail pages from ${source.name}...`);
}

export function reportExtractingDownloads(source: Source): void {
  console.log(`Extracting download URLs from ${source.name}...`);
}
