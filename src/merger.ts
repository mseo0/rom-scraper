import { GameEntry, MergedEntry, SourceGroup } from './types';
import { DownloadLink } from './fileHosts';

/**
 * Transforms a raw game name into a canonical form for comparison.
 *
 * Steps (in order):
 * 1. Trim leading/trailing whitespace
 * 2. Convert to lowercase
 * 3. Remove trademark (™), registered (®), and copyright (©) symbols
 * 4. Remove colons
 * 5. Replace ` - ` (space-hyphen-space separator pattern) with a single space
 * 6. Collapse consecutive whitespace into a single space
 * 7. Trim again (in case stripping created leading/trailing spaces)
 */
export function normalizeGameName(name: string): string {
  let result = name;

  // 1. Trim leading/trailing whitespace
  result = result.trim();

  // 2. Convert to lowercase
  result = result.toLowerCase();

  // 3. Remove trademark (™), registered (®), and copyright (©) symbols
  result = result.replace(/[™®©]/g, '');

  // 4. Remove colons
  result = result.replace(/:/g, '');

  // 5. Replace ` - ` (space-hyphen-space separator pattern) with a single space
  result = result.replace(/ - /g, ' ');

  // 6. Collapse consecutive whitespace into a single space
  result = result.replace(/\s+/g, ' ');

  // 7. Trim again
  result = result.trim();

  return result;
}

/**
 * Groups GameEntry objects by normalized game name and produces
 * consolidated MergedEntry objects with per-source download link groups.
 *
 * Algorithm:
 * 1. Create a Map keyed by canonical name
 * 2. Iterate entries in order, grouping by canonical name and source
 * 3. Convert the map to MergedEntry[], preserving insertion order
 * 4. Assign sequential indices starting from 1
 */
export function mergeEntries(entries: GameEntry[]): MergedEntry[] {
  const groupMap = new Map<
    string,
    { gameName: string; sourceMap: Map<string, SourceGroup> }
  >();

  for (const entry of entries) {
    const canonical = normalizeGameName(entry.gameName);

    // Find or create the group for this canonical name
    let group = groupMap.get(canonical);
    if (!group) {
      group = {
        gameName: entry.gameName,
        sourceMap: new Map<string, SourceGroup>(),
      };
      groupMap.set(canonical, group);
    }

    // Find or create the SourceGroup for this source within the group
    let sourceGroup = group.sourceMap.get(entry.sourceName);
    if (!sourceGroup) {
      sourceGroup = {
        sourceName: entry.sourceName,
        sourceUrl: entry.sourceUrl,
        detailPageUrl: entry.detailPageUrl,
        downloadLinks: [],
      };
      group.sourceMap.set(entry.sourceName, sourceGroup);
    }

    // Resolve download links: use downloadLinks if defined, otherwise
    // fall back to wrapping downloadUrl in a single DownloadLink
    const links: DownloadLink[] = entry.downloadLinks !== undefined
      ? entry.downloadLinks
      : [{ url: entry.downloadUrl, hostName: '' }];

    sourceGroup.downloadLinks.push(...links);
  }

  // Convert the map to MergedEntry[], preserving insertion order
  // and assigning sequential indices starting from 1
  const result: MergedEntry[] = [];
  let index = 1;

  for (const [, group] of groupMap) {
    result.push({
      index: index++,
      gameName: group.gameName,
      sourceGroups: Array.from(group.sourceMap.values()),
    });
  }

  return result;
}
