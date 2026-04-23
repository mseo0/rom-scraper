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
