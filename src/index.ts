#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { TARGET_SOURCES } from './sources';
import { scrapeAll } from './orchestrator';
import { formatSearchResults, formatNewReleases, formatGameList, formatGameLinks, truncate } from './formatter';
import { searchGames } from './search';
import { mergeEntries, normalizeGameName } from './merger';
import { MergedEntry } from './types';
import { DownloadLink } from './fileHosts';
import { runPingCommand } from './ping';
import { copyToClipboard } from './clipboard';
import { readConfig, writeConfig, resolveDownloadDir, getDownloadDir } from './auth';
import { runInit } from './init';
import { runCheckUpdates } from './updateChecker';
import { downloadFile } from './downloader';
import { createProgressBar } from './downloadProgress';
import { decompressNsz, isNszFile } from './nsz';
import { extractZip, isZipFile } from './zip';

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
  downloadDir?: string;
  init: boolean;
  checkUpdates: boolean;
  refreshCache: boolean;
  ignoreAction?: {
    type: 'add' | 'all' | 'reset' | 'list';
    gameName?: string;
  };
}

export function parseArgs(argv: string[]): CliArgs {
  // Strip node and script path
  const args = argv.slice(2);

  // --help / -h
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  switper [options] [query]

  Search:
    switper <query>                  Search by game name
    switper -s <query>               Search (explicit flag)
    switper                          Interactive search mode

  Commands:
    init                             Run interactive setup wizard
    check-updates                    Check for game updates
    --new                            Browse recently added games
    --ping                           Check if sources are reachable

  Update Options:
    --refresh                        Force a fresh scrape (with check-updates)
    --ignore <game_name>             Add a game to the ignore list
    --ignore all                     Suppress all update notifications
    --ignore reset                   Clear the ignore list
    --ignore list                    Show all ignored games

  Download:
    -d, --download-dir <path>        Set download directory

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

  // Detect subcommands: init and check-updates (first positional argument)
  const hasInit = args[0] === 'init';
  const hasCheckUpdates = args[0] === 'check-updates';

  // Detect --refresh flag (only meaningful with check-updates)
  const hasRefresh = args.includes('--refresh');

  // Detect --ignore flag and parse its argument
  const ignoreIndex = args.indexOf('--ignore');
  let ignoreAction: CliArgs['ignoreAction'] | undefined;
  if (ignoreIndex !== -1) {
    const nextArg = args[ignoreIndex + 1];
    if (nextArg === undefined || nextArg.trim() === '') {
      console.error('Error: --ignore requires an argument (game name, "all", "reset", or "list").');
      process.exit(1);
    }
    const lowerArg = nextArg.toLowerCase();
    if (lowerArg === 'all') {
      ignoreAction = { type: 'all' };
    } else if (lowerArg === 'reset') {
      ignoreAction = { type: 'reset' };
    } else if (lowerArg === 'list') {
      ignoreAction = { type: 'list' };
    } else {
      ignoreAction = { type: 'add', gameName: nextArg };
    }
  }

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

  // Check for --download-dir / -d flag
  let downloadDirIndex = args.indexOf('--download-dir');
  if (downloadDirIndex === -1) downloadDirIndex = args.indexOf('-d');
  let downloadDir: string | undefined;
  if (downloadDirIndex !== -1) {
    const nextArg = args[downloadDirIndex + 1];
    if (nextArg === undefined || nextArg.trim() === '') {
      console.error('Error: --download-dir requires a path argument.');
      process.exit(1);
    }
    downloadDir = nextArg;
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
  } else if (!hasInit && !hasCheckUpdates) {
    // Bare arguments (excluding flags and their values) become the search query
    // Only when not using init or check-updates subcommands
    const flagArgs = new Set(['--new', '--ping', '-s', '--no-validate', '-nv', '--download-dir', '-d', '--refresh', '--ignore']);
    const skipIndices = new Set<number>();
    // Mark -nv and its on/off value for skipping
    if (nvIndex !== -1) {
      skipIndices.add(nvIndex);
      const nextArg = args[nvIndex + 1]?.toLowerCase();
      if (nextArg === 'on' || nextArg === 'off') {
        skipIndices.add(nvIndex + 1);
      }
    }
    // Mark --download-dir / -d and its path value for skipping
    if (downloadDirIndex !== -1) {
      skipIndices.add(downloadDirIndex);
      if (args[downloadDirIndex + 1] !== undefined) {
        skipIndices.add(downloadDirIndex + 1);
      }
    }
    // Mark --ignore and its argument for skipping
    if (ignoreIndex !== -1) {
      skipIndices.add(ignoreIndex);
      if (args[ignoreIndex + 1] !== undefined) {
        skipIndices.add(ignoreIndex + 1);
      }
    }
    const bareArgs = args.filter((a, i) => !flagArgs.has(a) && !skipIndices.has(i));
    if (bareArgs.length > 0) {
      const query = bareArgs.join(' ').trim();
      if (query) searchQuery = query;
    }
  }

  // Conflict detection: existing conflicts
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

  // Conflict detection: init and check-updates cannot combine with --search, --new, or each other
  if (hasInit && hasCheckUpdates) {
    console.error('Error: init and check-updates cannot be used together.');
    process.exit(1);
  }

  if (hasInit && (searchQuery !== null || hasNew)) {
    console.error('Error: init cannot be combined with --search or --new.');
    process.exit(1);
  }

  if (hasCheckUpdates && (searchQuery !== null || hasNew)) {
    console.error('Error: check-updates cannot be combined with --search or --new.');
    process.exit(1);
  }

  return {
    searchQuery,
    newReleases: hasNew,
    ping: hasPing,
    noValidate: hasNoValidate,
    validateToggle,
    downloadDir,
    init: hasInit,
    checkUpdates: hasCheckUpdates,
    refreshCache: hasRefresh,
    ignoreAction,
  };
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

    // Link download loop for selected game
    console.clear();
    console.log(text);
    console.log('');
    await runLinkPrompt(linkMap);

    // After exiting link prompt, loop back to game list
    if (!isInteractive) {
      break;
    }
  }
}

/**
 * Open a URL in the default browser.
 */
function openInBrowser(url: string): boolean {
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      // -g opens in background, keeping terminal in front
      execSync(`open -g "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'linux') {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function runLinkPrompt(
  linkMap: Map<number, DownloadLink>,
): Promise<void> {
  const maxKey = Math.max(...linkMap.keys());

  while (true) {
    const answer = await prompt('  Download link #: ');

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

    const link = linkMap.get(num)!;

    if (link.hostType === 'direct') {
      console.log(`  Downloading [${num}]...`);
      const downloadDir = getDownloadDir();
      const progressBar = createProgressBar({ totalBytes: null });
      let progressTotalBytes: number | null = null;

      const result = await downloadFile({
        url: link.url,
        downloadDir,
        onProgress: (progress) => {
          if (progressTotalBytes === null && progress.totalBytes !== null) {
            progressTotalBytes = progress.totalBytes;
            // Recreate progress bar with known total (update closure)
          }
          progressBar.update(progress.bytesDownloaded, progress.speedBytesPerSec);
        },
      });

      if (result.success) {
        progressBar.finish(result.totalBytes, result.filePath);

        // Post-download pipeline: zip extract → nsz decompress → cleanup
        let filesToProcess = [result.filePath];

        // Step 1: Extract zip if needed
        if (isZipFile(result.filePath)) {
          const extractResult = await extractZip(result.filePath);
          if (extractResult.success) {
            filesToProcess = extractResult.files;
            // Trash the zip file
            try { fs.unlinkSync(result.filePath); } catch { /* ignore */ }
          } else {
            console.log(`  Extraction failed: ${extractResult.error}`);
          }
        }

        // Step 2: Decompress any .nsz files found
        for (const file of filesToProcess) {
          if (isNszFile(file)) {
            const decompressResult = await decompressNsz(file);
            if (decompressResult.success) {
              // Trash the .nsz file after successful decompression
              try { fs.unlinkSync(file); } catch { /* ignore */ }
            } else {
              console.log(`  ${decompressResult.error}`);
            }
          }
        }
      } else {
        // Download failed — print error and fall back to browser
        const statusMsg = result.statusCode ? ` (${result.statusCode})` : '';
        console.log(`  Download failed${statusMsg}: ${result.error}`);
        console.log(`  Opening in browser...`);
        if (!openInBrowser(link.url)) {
          const clipResult = copyToClipboard(link.url);
          if (clipResult.success) {
            console.log(`  Copied URL to clipboard: ${truncate(link.url, 60)}`);
          } else {
            console.log(`  Could not open or copy link. URL: ${link.url}`);
          }
        }
      }
    } else {
      // browser-only host
      console.log(`  Opening [${num}] in browser...`);
      if (openInBrowser(link.url)) {
        console.log(`  Opened: ${truncate(link.url, 60)}`);
      } else {
        const clipResult = copyToClipboard(link.url);
        if (clipResult.success) {
          console.log(`  Copied [${num}]: ${truncate(link.url, 60)}`);
        } else {
          console.log(`  Could not open or copy link. URL: ${link.url}`);
        }
      }
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
  console.log(bold(cyan('  switper')));
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
    console.log(bold(cyan('  switper')));
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
  const {
    searchQuery, newReleases, ping, noValidate, validateToggle,
    downloadDir, init, checkUpdates, refreshCache, ignoreAction,
  } = parseArgs(process.argv);

  // Handle persistent toggle: switper -nv on / switper -nv off
  if (validateToggle) {
    const config = readConfig();
    config.validate = validateToggle === 'on';
    writeConfig(config);
    const state = validateToggle === 'on' ? 'enabled' : 'disabled';
    console.log(`Link validation ${state}.`);
    return;
  }

  // Route: switper init
  if (init) {
    await runInit();
    return;
  }

  // Route: switper check-updates [--refresh]
  if (checkUpdates) {
    await runCheckUpdates({ forceRefresh: refreshCache, noValidate });
    return;
  }

  // Route: switper --ignore <action>
  if (ignoreAction) {
    const config = readConfig() as Record<string, unknown>;
    switch (ignoreAction.type) {
      case 'add': {
        const normalized = normalizeGameName(ignoreAction.gameName!);
        const ignoreList = (config.ignoreList as string[] | undefined) ?? [];
        if (!ignoreList.includes(normalized)) {
          ignoreList.push(normalized);
        }
        config.ignoreList = ignoreList;
        writeConfig(config as any);
        console.log(`Added "${normalized}" to ignore list.`);
        return;
      }
      case 'all': {
        config.ignoreAll = true;
        writeConfig(config as any);
        console.log('All update notifications are now suppressed.');
        return;
      }
      case 'reset': {
        delete config.ignoreList;
        delete config.ignoreAll;
        writeConfig(config as any);
        console.log('Ignore list cleared.');
        return;
      }
      case 'list': {
        const ignoreList = (config.ignoreList as string[] | undefined) ?? [];
        const ignoreAll = (config.ignoreAll as boolean | undefined) ?? false;
        if (ignoreAll) {
          console.log('All games are currently ignored (--ignore all is set).');
        } else if (ignoreList.length === 0) {
          console.log('No games are currently ignored.');
        } else {
          console.log('Ignored games:');
          for (const name of ignoreList) {
            console.log(`  - ${name}`);
          }
        }
        return;
      }
    }
  }

  // Handle --download-dir: resolve, save to config, print confirmation, then continue
  if (downloadDir) {
    const resolved = resolveDownloadDir(downloadDir);
    const config = readConfig();
    config.downloadDir = resolved;
    writeConfig(config);
    console.log(`Download directory set to: ${resolved}`);
  }

  // Validate that the effective download directory is writable
  const effectiveDownloadDir = getDownloadDir();
  try {
    fs.mkdirSync(effectiveDownloadDir, { recursive: true });
    fs.accessSync(effectiveDownloadDir, fs.constants.W_OK);
  } catch {
    console.error(`Error: Download directory is not writable: ${effectiveDownloadDir}`);
    process.exit(1);
  }

  if (ping) {
    await runPingCommand(TARGET_SOURCES);
  } else if (newReleases) {
    await runNewReleases(noValidate);
  } else if (searchQuery !== null) {
    // Direct search mode (switper zelda / switper --search zelda)
    await runSearch(searchQuery, noValidate);
  } else {
    // Interactive mode (just switper)
    await interactiveMode(noValidate);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
