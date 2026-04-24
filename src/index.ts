#!/usr/bin/env node
import { TARGET_SOURCES } from './sources';
import { scrapeAll } from './orchestrator';
import { formatResults, formatSearchResults } from './formatter';
import { searchGames } from './search';

export interface CliArgs {
  searchQuery: string | null;
}

export function parseArgs(argv: string[]): CliArgs {
  const searchIndex = argv.indexOf('--search');
  if (searchIndex === -1) {
    return { searchQuery: null };
  }

  const nextArg = argv[searchIndex + 1];
  if (nextArg === undefined || nextArg.trim() === '') {
    console.error('Error: --search requires a search term.');
    process.exit(1);
  }

  return { searchQuery: nextArg };
}

async function main(): Promise<void> {
  const { searchQuery } = parseArgs(process.argv);
  const { entries, errors } = await scrapeAll(TARGET_SOURCES, searchQuery);

  if (searchQuery === null) {
    // Normal mode
    const output = formatResults(entries, errors);
    console.log(output);
  } else {
    // Search mode
    const filtered = searchGames(searchQuery, entries);
    const output = formatSearchResults(filtered, searchQuery, errors);
    console.log(output);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
