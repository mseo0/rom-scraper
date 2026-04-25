import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseRomFilename } from './filenameParser';
import { scrapeAll } from './orchestrator';
import { TARGET_SOURCES } from './sources';
import { GameEntry } from './types';

export interface CachedGameEntry {
  normalizedName: string;
  rawName: string;
  version: string | null;
  sourceName: string;
}

export interface UpdateCache {
  timestamp: number;  // Unix epoch ms
  entries: CachedGameEntry[];
}

/** Default TTL: 24 hours in milliseconds */
export const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

/** Cache file path */
export const CACHE_FILE_PATH = path.join(os.homedir(), '.switper-cache.json');

/**
 * Read the cache file. Returns null if missing, corrupted, or expired.
 * Corrupted/unreadable cache is silently treated as expired.
 */
export function readCache(ttl?: number): UpdateCache | null {
  const effectiveTtl = ttl ?? DEFAULT_CACHE_TTL;

  try {
    const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
    const data: UpdateCache = JSON.parse(raw);

    // Validate structure
    if (typeof data.timestamp !== 'number' || !Array.isArray(data.entries)) {
      return null;
    }

    // Check TTL expiration
    const elapsed = Date.now() - data.timestamp;
    if (elapsed > effectiveTtl) {
      return null;
    }

    return data;
  } catch {
    // Missing, corrupted, or unreadable — treat as expired
    return null;
  }
}

/**
 * Write scraped data to the cache file.
 * Write failures log a warning but do not throw.
 */
export function writeCache(entries: CachedGameEntry[]): void {
  const cache: UpdateCache = {
    timestamp: Date.now(),
    entries,
  };

  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`Warning: Could not write cache file: ${(err as Error).message}`);
  }
}

/**
 * Convert scraped GameEntry[] into CachedGameEntry[] by extracting
 * version info from gameName using parseRomFilename.
 */
function toCachedEntries(gameEntries: GameEntry[]): CachedGameEntry[] {
  return gameEntries.map((entry) => {
    const parsed = parseRomFilename(entry.gameName);
    return {
      normalizedName: parsed.normalizedName,
      rawName: parsed.rawName,
      version: parsed.version,
      sourceName: entry.sourceName,
    };
  });
}

/**
 * Get cached data, performing a fresh scrape if needed.
 * If forceRefresh is true, always scrapes regardless of TTL.
 */
export async function getCachedData(options: {
  forceRefresh?: boolean;
  ttl?: number;
  noValidate?: boolean;
}): Promise<CachedGameEntry[]> {
  // Check cache first (unless force refresh)
  if (!options.forceRefresh) {
    const cached = readCache(options.ttl);
    if (cached) {
      return cached.entries;
    }
  }

  // Perform fresh scrape
  const scrapeOptions = options.noValidate === true ? { validate: false } : undefined;
  const { entries } = await scrapeAll(TARGET_SOURCES, null, false, scrapeOptions);

  // Convert to cached entries
  const cachedEntries = toCachedEntries(entries);

  // Write to cache
  writeCache(cachedEntries);

  return cachedEntries;
}
