#!/usr/bin/env node
import * as readline from 'readline';
import { TARGET_SOURCES } from './sources';
import { scrapeAll } from './orchestrator';
import { formatSearchResults, formatNewReleases, formatGameList, formatGameLinks, truncate } from './formatter';
import { searchGames } from './search';
import { mergeEntries } from './merger';
import { MergedEntry } from './types';
import { runPingCommand } from './ping';
import { copyToClipboard } from './clipboard';
import { readConfig, writeConfig } from './auth';

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
  /** When set, -nv on/off was used — save to config and exit */
  validateToggle?: 'on' | 'off';
}

export function parseArgs(argv: string[]): CliArgs {
  // Strip node and script path
  const args = argv.slice(2);

  // --help / -h
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  rom-scraper [options] [query]

  Search:
    rom-scraper <query>              Search by game name
    rom-scraper -s <query>           Search (explicit flag)
    rom-scraper                      Interactive search mode

  Commands:
    --new                            Browse recently added games
    --ping                           Check if sources are reachable

  Validation:
    -nv, --no-validate               Skip link validation (one-off)
    -nv off                          Disable validation persistently
    -nv on                           Re-enable validation persistently

  Other:
    -h, --help                       Show this help message
`);
    process.exit(0);
  }

  const hasNew = args.includes('--new');
  const hasPing = args.includes('--ping');

  // Check for -nv on / -nv off (persistent toggle)
  const nvIndex = args.indexOf('-nv');
  const noValidateIndex = args.indexOf('--no-validate');
  let validateToggle: 'on' | 'off' | undefined;
  let hasNoValidate = false;

  if (nvIndex !== -1) {
    const nextArg = args[nvIndex + 1]?.toLowerCase();
    if (nextArg === 'on' || nextArg === 'off') {
      validateToggle = nextArg;
    } else {
      // -nv without on/off is a one-off override
      hasNoValidate = true;
    }
  }

  if (noValidateIndex !== -1) {
    hasNoValidate = true;
  }

  // If no explicit flag, check persistent config
  if (!hasNoValidate && !validateToggle) {
    const config = readConfig();
    if (config.validate === false) {
      hasNoValidate = true;
    }
  }

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
    // Bare arguments (excluding flags and their values) become the search query
    const flagArgs = new Set(['--new', '--ping', '-s', '--no-validate', '-nv']);
    const skipIndices = new Set<number>();
    // Mark -nv and its on/off value for skipping
    if (nvIndex !== -1) {
      skipIndices.add(nvIndex);
      const nextArg = args[nvIndex + 1]?.toLowerCase();
      if (nextArg === 'on' || nextArg === 'off') {
        skipIndices.add(nvIndex + 1);
      }
    }
    const bareArgs = args.filter((a, i) => !flagArgs.has(a) && !skipIndices.has(i));
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

  return { searchQuery, newReleases: hasNew, ping: hasPing, noValidate: hasNoValidate, validateToggle };
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

/**
 * Two-step browse UI: game list → pick game → see links → copy → back to list.
 * Works for both search results and new releases.
 */
async function browseResults(
  entries: MergedEntry[],
  header: string,
  errors: string[],
  isInteractive: boolean,
): Promise<void> {
  if (entries.length === 0) {
    console.clear();
    console.log(formatGameList(entries, header, errors));
    if (isInteractive) {
      await prompt(dim('\n  Press Enter to go back...'));
    }
    return;
  }

  // Game selection loop
  while (true) {
    console.clear();
    console.log(formatGameList(entries, header, errors));
    console.log('');

    const answer = await prompt(green('  Select game #: '));
    const lower = answer.toLowerCase();
    if (lower === 'q' || lower === 'quit' || lower === 'exit' || answer === '') {
      break;
    }

    const num = Number(answer);
    if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > entries.length) {
      continue;
    }

    const entry = entries[num - 1];
    const { text, linkMap } = formatGameLinks(entry);

    if (linkMap.size === 0) {
      continue;
    }

    // Link copy loop for selected game
    console.clear();
    console.log(text);
    console.log('');
    await runClipboardPrompt(linkMap);

    // After exiting link prompt, loop back to game list
    if (!isInteractive) {
      break;
    }
  }
}

export async function runClipboardPrompt(
  linkMap: Map<number, string>,
): Promise<void> {
  const maxKey = Math.max(...linkMap.keys());

  while (true) {
    const answer = await prompt('  Copy link #: ');

    const lower = answer.toLowerCase();
    if (lower === 'q' || lower === 'quit' || lower === 'exit' || answer === '') {
      break;
    }

    const num = Number(answer);

    if (isNaN(num) || !Number.isInteger(num)) {
      console.log('  Invalid input. Enter a link number or q to go back.');
      continue;
    }

    if (num < 1 || num > maxKey) {
      console.log(`  Invalid link number. Enter a number between 1 and ${maxKey}.`);
      continue;
    }

    const url = linkMap.get(num)!;
    const result = copyToClipboard(url);

    if (result.success) {
      console.log(`  Copied [${num}]: ${truncate(url, 60)}`);
    } else {
      console.log(`  Clipboard error: ${result.error}`);
    }
  }
}

async function runSearch(query: string, noValidate: boolean = false): Promise<void> {
  const { entries, errors } = await scrapeAll(TARGET_SOURCES, query, false, { validate: !noValidate });
  const merged = mergeEntries(entries);
  const filtered = searchGames(query, merged);
  const header = filtered.length === 0
    ? `No games found matching '${query}'.`
    : `Found ${filtered.length} result(s) for '${query}':`;
  await browseResults(filtered, header, errors, false);
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

    const { entries, errors } = await scrapeAll(TARGET_SOURCES, query, false, { validate: !noValidate });
    const merged = mergeEntries(entries);
    const filtered = searchGames(query, merged);
    const header = filtered.length === 0
      ? `No games found matching '${query}'.`
      : `Found ${filtered.length} result(s) for '${query}':`;
    await browseResults(filtered, header, errors, true);

    // Restore the interactive mode header after returning from browse
    console.clear();
    console.log('');
    console.log(bold(cyan('  rom-scraper')));
    console.log(dim('  Nintendo Switch ROM search tool'));
    console.log('');
  }
}

async function runNewReleases(noValidate: boolean = false): Promise<void> {
  const { entries, errors } = await scrapeAll(TARGET_SOURCES, null, true, { validate: !noValidate });
  const merged = mergeEntries(entries);
  const header = merged.length === 0
    ? 'No new releases found.'
    : `New Releases — ${merged.length} game(s) found:`;
  await browseResults(merged, header, errors, false);
}

async function main(): Promise<void> {
  const { searchQuery, newReleases, ping, noValidate, validateToggle } = parseArgs(process.argv);

  // Handle persistent toggle: rom-scraper -nv on / rom-scraper -nv off
  if (validateToggle) {
    const config = readConfig();
    config.validate = validateToggle === 'on';
    writeConfig(config);
    const state = validateToggle === 'on' ? 'enabled' : 'disabled';
    console.log(`Link validation ${state}.`);
    return;
  }

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
