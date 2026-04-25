import * as fs from 'fs';
import * as path from 'path';
import { parseRomFilename, compareVersions } from './filenameParser';
import { CachedGameEntry, getCachedData } from './updateCache';
import { readConfig } from './auth';
import { formatUpdateResults } from './formatter';

export interface LocalGame {
  filename: string;
  normalizedName: string;
  version: string | null;
}

export interface UpdateInfo {
  gameName: string;
  localVersion: string | null;
  availableVersion: string;
  sourceName: string;
}

/** ROM file extensions to scan for (lowercase, with leading dot). */
const ROM_EXTENSIONS = new Set(['.nsp', '.nsz', '.xci']);

/**
 * Scan a directory recursively for ROM files (.nsp, .nsz, .xci).
 * Returns the list of filenames found (basenames only).
 *
 * If the directory does not exist or is not readable, logs a warning
 * and returns an empty array.
 */
export function scanLibrary(libraryDir: string): string[] {
  try {
    const allFiles = fs.readdirSync(libraryDir, { recursive: true }) as string[];
    return allFiles.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ROM_EXTENSIONS.has(ext);
    });
  } catch (err) {
    console.warn(
      `Warning: Could not read library directory "${libraryDir}": ${(err as Error).message}`,
    );
    return [];
  }
}

/**
 * Build the list of local games from scanned filenames.
 * Parses each filename via parseRomFilename and returns LocalGame objects.
 */
export function buildLocalGameList(filenames: string[]): LocalGame[] {
  return filenames.map((filename) => {
    const basename = path.basename(filename);
    const parsed = parseRomFilename(basename);
    return {
      filename: basename,
      normalizedName: parsed.normalizedName,
      version: parsed.version,
    };
  });
}

/**
 * Compare local games against cached scraped data.
 * Returns games that have available updates, excluding ignored games.
 *
 * When ignoreAll is true, returns an empty array immediately.
 * When a game's normalized name is in the ignore list, it is excluded.
 * When multiple scraped entries match the same local game, the one with
 * the highest version wins.
 * When a local game has null version and a cached entry has a non-null
 * version, it is classified as an update available.
 */
export function detectUpdates(
  localGames: LocalGame[],
  cachedEntries: CachedGameEntry[],
  ignoreList: string[],
  ignoreAll: boolean,
): UpdateInfo[] {
  if (ignoreAll) {
    return [];
  }

  const ignoreSet = new Set(ignoreList.map((name) => name.toLowerCase()));

  // Build a map of cached entries by normalized name.
  // When multiple entries match the same name, keep the one with the highest version.
  const cachedMap = new Map<string, CachedGameEntry>();
  for (const entry of cachedEntries) {
    const existing = cachedMap.get(entry.normalizedName);
    if (!existing) {
      cachedMap.set(entry.normalizedName, entry);
    } else {
      // Keep the entry with the higher version
      if (entry.version !== null && existing.version !== null) {
        if (compareVersions(entry.version, existing.version) > 0) {
          cachedMap.set(entry.normalizedName, entry);
        }
      } else if (entry.version !== null && existing.version === null) {
        // Prefer the entry that has a version
        cachedMap.set(entry.normalizedName, entry);
      }
    }
  }

  const updates: UpdateInfo[] = [];

  for (const local of localGames) {
    // Skip ignored games
    if (ignoreSet.has(local.normalizedName.toLowerCase())) {
      continue;
    }

    const cached = cachedMap.get(local.normalizedName);
    if (!cached || cached.version === null) {
      continue;
    }

    // Local has no version but cached has one → update available
    if (local.version === null) {
      updates.push({
        gameName: cached.rawName,
        localVersion: null,
        availableVersion: cached.version,
        sourceName: cached.sourceName,
      });
      continue;
    }

    // Both have versions — compare them
    if (compareVersions(cached.version, local.version) > 0) {
      updates.push({
        gameName: cached.rawName,
        localVersion: local.version,
        availableVersion: cached.version,
        sourceName: cached.sourceName,
      });
    }
  }

  return updates;
}

/**
 * Top-level command handler for `switper check-updates`.
 *
 * 1. Reads config via readConfig()
 * 2. Checks if libraryDir is configured — if not, displays error
 * 3. Scans library directory
 * 4. Gets cached data (with forceRefresh option)
 * 5. Detects updates (passing ignoreList and ignoreAll from config)
 * 6. Formats and prints results
 */
export async function runCheckUpdates(options: {
  forceRefresh?: boolean;
  noValidate?: boolean;
}): Promise<void> {
  const config = readConfig() as Record<string, unknown>;

  const libraryDir = config.libraryDir as string | undefined;
  if (!libraryDir) {
    console.error(
      '\x1b[31mError: Game library directory is not configured.\x1b[0m\n' +
      'Run \x1b[36mswitper init\x1b[0m to set up your library path.',
    );
    return;
  }

  // Scan library
  const filenames = scanLibrary(libraryDir);
  if (filenames.length === 0) {
    console.log('No ROM files found in your library.');
    return;
  }

  const localGames = buildLocalGameList(filenames);

  // Get cached scraped data
  const cachedEntries = await getCachedData({
    forceRefresh: options.forceRefresh,
    noValidate: options.noValidate,
  });

  // Detect updates
  const ignoreList = (config.ignoreList as string[] | undefined) ?? [];
  const ignoreAll = (config.ignoreAll as boolean | undefined) ?? false;
  const updates = detectUpdates(localGames, cachedEntries, ignoreList, ignoreAll);

  // Format and print results
  console.log(formatUpdateResults(updates));
}
