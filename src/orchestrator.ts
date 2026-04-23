import { Source, GameEntry } from './types';
import { fetchSource } from './fetcher';
import { parseSource } from './parser';
import { reportFetching, reportParsing, reportComplete } from './progress';

export async function scrapeAll(sources: Source[]): Promise<{entries: GameEntry[], errors: string[]}> {
  const allEntries: GameEntry[] = [];
  const allErrors: string[] = [];
  let index = 1;

  for (const source of sources) {
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

  // 8. Report completion
  reportComplete();

  return { entries: allEntries, errors: allErrors };
}
