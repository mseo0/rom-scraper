#!/usr/bin/env node
import * as readline from 'readline';
import { TARGET_SOURCES } from './sources';
import { scrapeAll } from './orchestrator';
import { formatResults, formatSearchResults } from './formatter';
import { searchGames } from './search';

// ANSI color helpers
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface CliArgs {
  searchQuery: string | null;
}

export function parseArgs(argv: string[]): CliArgs {
  // Strip node and script path
  const args = argv.slice(2);

  // Check for --search flag first (backward compat)
  const searchIndex = args.indexOf('--search');
  if (searchIndex !== -1) {
    const nextArg = args[searchIndex + 1];
    if (nextArg === undefined || nextArg.trim() === '') {
      console.error('Error: --search requires a search term.');
      process.exit(1);
    }
    return { searchQuery: nextArg };
  }

  // Any remaining args become the search query
  if (args.length > 0) {
    const query = args.join(' ').trim();
    if (query) {
      return { searchQuery: query };
    }
  }

  return { searchQuery: null };
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runSearch(query: string): Promise<void> {
  const { entries, errors } = await scrapeAll(TARGET_SOURCES, query);
  const filtered = searchGames(query, entries);
  const output = formatSearchResults(filtered, query, errors);
  console.log(output);
}

async function interactiveMode(): Promise<void> {
  console.log('');
  console.log(bold(cyan('  rom-scraper')));
  console.log(dim('  Nintendo Switch ROM search tool'));
  console.log('');

  while (true) {
    const query = await prompt(green('  Search Game: '));

    if (!query) {
      console.log(dim('  No query entered. Exiting.'));
      break;
    }

    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit' || query.toLowerCase() === 'q') {
      console.log(dim('  Goodbye!'));
      break;
    }

    console.log('');
    console.log(yellow(`  Searching for "${query}"...`));
    console.log('');

    await runSearch(query);

    console.log('');
  }
}

async function main(): Promise<void> {
  const { searchQuery } = parseArgs(process.argv);

  if (searchQuery !== null) {
    // Direct search mode (rom-scraper zelda / rom-scraper --search zelda)
    await runSearch(searchQuery);
  } else {
    // Interactive mode (just rom-scraper)
    await interactiveMode();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
