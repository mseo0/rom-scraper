#!/usr/bin/env node
import * as readline from 'readline';
import { TARGET_SOURCES } from './sources';
import { scrapeAll } from './orchestrator';
import { formatResults, formatSearchResults, formatNewReleases } from './formatter';
import { searchGames } from './search';
import { mergeEntries } from './merger';
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
  noValidate: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  // Strip node and script path
  const args = argv.slice(2);

  const hasNew = args.includes('--new');
  const hasPing = args.includes('--ping');
  const hasNoValidate = args.includes('--no-validate');

  // Check for --search or -s flag
  let searchIndex = args.indexOf('--search');
  if (searchIndex === -1) searchIndex = args.indexOf('-s');
  let searchQuery: string | null = null;
  if (searchIndex !== -1) {
    const nextArg = args[searchIndex + 1];
    if (nextArg === undefined || nextArg.trim() === '') {
      console.error('Error: --search requires a search term.');
      process.exit(1);
    }
    searchQuery = nextArg;
  } else {
    // Bare arguments (excluding --new, --ping, -s) become the search query
    const bareArgs = args.filter(a => a !== '--new' && a !== '--ping' && a !== '-s' && a !== '--no-validate');
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

  if (hasNoValidate && hasPing) {
    console.error('Error: --no-validate and --ping cannot be used together.');
    process.exit(1);
  }

  return { searchQuery, newReleases: hasNew, ping: hasPing, noValidate: hasNoValidate };
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

async function runSearch(query: string, noValidate: boolean = false): Promise<void> {
  const { entries, errors } = await scrapeAll(TARGET_SOURCES, query, false, { validate: !noValidate });
  const merged = mergeEntries(entries);
  const filtered = searchGames(query, merged);
  const output = formatSearchResults(filtered, query, errors);
  console.log(output);
}

async function interactiveMode(noValidate: boolean = false): Promise<void> {
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

    await runSearch(query, noValidate);

    console.log('');
  }
}

async function runNewReleases(noValidate: boolean = false): Promise<void> {
  const { entries, errors } = await scrapeAll(TARGET_SOURCES, null, true, { validate: !noValidate });
  const merged = mergeEntries(entries);
  const output = formatNewReleases(merged, errors);
  console.log(output);
}

async function main(): Promise<void> {
  const { searchQuery, newReleases, ping, noValidate } = parseArgs(process.argv);

  if (ping) {
    await runPingCommand(TARGET_SOURCES);
  } else if (newReleases) {
    await runNewReleases(noValidate);
  } else if (searchQuery !== null) {
    // Direct search mode (rom-scraper zelda / rom-scraper --search zelda)
    await runSearch(searchQuery, noValidate);
  } else {
    // Interactive mode (just rom-scraper)
    await interactiveMode(noValidate);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
