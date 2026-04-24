#!/usr/bin/env node
import * as readline from 'readline';
import { TARGET_SOURCES } from './sources';
import { scrapeAll } from './orchestrator';
import { formatResults, formatSearchResults, formatNewReleases } from './formatter';
import { searchGames } from './search';
import { runPingCommand } from './ping';

// ANSI color helpers
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface CliArgs {
  searchQuery: string | null;
  newReleases: boolean;
  ping: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  // Strip node and script path
  const args = argv.slice(2);

  const hasNew = args.includes('--new');
  const hasPing = args.includes('--ping');

  // Check for --search flag
  const searchIndex = args.indexOf('--search');
  let searchQuery: string | null = null;
  if (searchIndex !== -1) {
    const nextArg = args[searchIndex + 1];
    if (nextArg === undefined || nextArg.trim() === '') {
      console.error('Error: --search requires a search term.');
      process.exit(1);
    }
    searchQuery = nextArg;
  } else {
    // Bare arguments (excluding --new and --ping) become the search query
    const bareArgs = args.filter(a => a !== '--new' && a !== '--ping');
    if (bareArgs.length > 0) {
      const query = bareArgs.join(' ').trim();
      if (query) searchQuery = query;
    }
  }

  // Conflict detection
  if (hasNew && searchQuery !== null) {
    console.error('Error: --new and search query cannot be used together.');
    process.exit(1);
  }

  if (hasPing && searchQuery !== null) {
    console.error('Error: --ping cannot be used with a search query.');
    process.exit(1);
  }

  if (hasPing && hasNew) {
    console.error('Error: --ping and --new cannot be used together.');
    process.exit(1);
  }

  return { searchQuery, newReleases: hasNew, ping: hasPing };
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

async function runNewReleases(): Promise<void> {
  const { entries, errors } = await scrapeAll(TARGET_SOURCES, null, true);
  const output = formatNewReleases(entries, errors);
  console.log(output);
}

async function main(): Promise<void> {
  const { searchQuery, newReleases, ping } = parseArgs(process.argv);

  if (ping) {
    await runPingCommand(TARGET_SOURCES);
  } else if (newReleases) {
    await runNewReleases();
  } else if (searchQuery !== null) {
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
