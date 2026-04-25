import { GameEntry, MergedEntry, SourceGroup } from './types';
import { DownloadLink } from './fileHosts';

/** Minimum Jaccard similarity score for fuzzy matching */
const FUZZY_THRESHOLD = 0.8;

/** Minimum number of tokens required in both sets for fuzzy matching */
const MIN_TOKEN_COUNT = 2;

/**
 * Internal representation of a merge group during the two-pass algorithm.
 * Not exported — used only within mergeEntries().
 */
interface MergeGroup {
  canonicalName: string;
  displayName: string;
  tokens: Set<string>;
  sourceMap: Map<string, SourceGroup>;
}

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
 * 8. Remove bracketed version tags (e.g., [v1.2.3], [v1.0.1+dlc])
 * 9. Remove bare version strings (e.g., v1.0, v2.1.3)
 * 10. Remove region tags in parentheses (e.g., (usa), (eur), (japan))
 * 11. Remove platform tags as whole words (nsw, switch, nintendo switch, ns)
 * 12. Remove file format tags as whole words (nsp, xci, nsz, xcz)
 * 13. Remove packaging descriptors (update, dlc, +)
 * 14. Collapse consecutive whitespace into a single space
 * 15. Trim again
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

  // 8. Remove bracketed version tags: [v1.2.3], [v1.0.1+dlc], etc.
  result = result.replace(/\[v[\d.+a-z]*\]/g, '');

  // 9. Remove bare version strings: v1.0, v2.1.3, etc.
  result = result.replace(/\bv\d+(\.\d+)*\b/g, '');

  // 10. Remove region tags in parentheses: (usa), (eur), (europe), (japan), (jpn), (jp), (world), (us), (eu)
  result = result.replace(/\((usa|eur|europe|japan|jpn|jp|world|us|eu)\)/g, '');

  // 11. Remove platform tags as whole words: nsw, switch, nintendo switch, ns
  result = result.replace(/\b(nintendo switch|nsw|switch|ns)\b/g, '');

  // 12. Remove file format tags as whole words: nsp, xci, nsz, xcz
  result = result.replace(/\b(nsp|xci|nsz|xcz)\b/g, '');

  // 13. Remove packaging descriptors: "+ update", "+ dlc", standalone "+"
  //     NXBrew appends these to game names (e.g., "Zelda Switch NSP + Update + DLC")
  result = result.replace(/\b(update|dlc)\b/g, '');
  result = result.replace(/\+/g, '');

  // 14. Collapse consecutive whitespace into a single space
  result = result.replace(/\s+/g, ' ');

  // 15. Trim again
  result = result.trim();

  return result;
}

/**
 * Splits a canonical name on whitespace and returns the set of unique tokens.
 * Empty string returns an empty set.
 */
export function tokenize(canonicalName: string): Set<string> {
  if (canonicalName === '') return new Set();
  return new Set(canonicalName.split(/\s+/));
}

/**
 * Computes the Jaccard similarity coefficient: |A ∩ B| / |A ∪ B|.
 * Returns 0 if both sets are empty (avoids division by zero).
 * Result is always in [0, 1].
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersectionSize = 0;
  for (const item of a) {
    if (b.has(item)) intersectionSize++;
  }

  const unionSize = a.size + b.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Groups GameEntry objects by normalized game name and produces
 * consolidated MergedEntry objects with per-source download link groups.
 *
 * Two-pass algorithm:
 *   Pass 1: Group entries by exact canonical name into MergeGroup objects
 *   Pass 2: Fuzzy-match groups across sources using Jaccard similarity
 *           with greedy best-match pairing
 */
export function mergeEntries(entries: GameEntry[]): MergedEntry[] {
  // === Pass 1: Exact canonical matching ===
  const groupMap = new Map<string, MergeGroup>();

  for (const entry of entries) {
    const canonical = normalizeGameName(entry.gameName);

    // Find or create the group for this canonical name
    let group = groupMap.get(canonical);
    if (!group) {
      group = {
        canonicalName: canonical,
        displayName: entry.gameName,
        tokens: tokenize(canonical),
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
      : [{ url: entry.downloadUrl, hostName: '', hostType: 'direct' as const }];

    sourceGroup.downloadLinks.push(...links);
  }

  // Convert map to array of MergeGroups (preserving insertion order)
  let groups: MergeGroup[] = Array.from(groupMap.values());

  // === Pass 2: Fuzzy matching across sources ===
  let merged = true;
  while (merged) {
    merged = false;
    const bestPair = findBestFuzzyPair(groups);

    if (bestPair) {
      const { i, j } = bestPair;
      const mergedGroup = mergeTwoGroups(groups[i], groups[j]);

      // Remove both groups (j first since j > i) and add merged group
      groups.splice(j, 1);
      groups.splice(i, 1);
      // Insert merged group at position i to maintain relative order
      groups.splice(i, 0, mergedGroup);

      merged = true;
    }
  }

  // === Convert final groups to MergedEntry[] with sequential indices ===
  const result: MergedEntry[] = [];
  let index = 1;

  for (const group of groups) {
    result.push({
      index: index++,
      gameName: group.displayName,
      sourceGroups: Array.from(group.sourceMap.values()),
    });
  }

  return result;
}

/**
 * Find the best eligible fuzzy pair among the groups.
 * Returns the indices of the best pair, or null if no eligible pair exists.
 *
 * Eligible pairs must:
 * - Have cross-source entries (union of source names >= 2)
 * - Both have at least MIN_TOKEN_COUNT tokens
 * - Have Jaccard similarity >= FUZZY_THRESHOLD
 */
function findBestFuzzyPair(
  groups: MergeGroup[],
): { i: number; j: number; score: number } | null {
  let best: { i: number; j: number; score: number } | null = null;

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const groupA = groups[i];
      const groupB = groups[j];

      // Check minimum token count for both groups
      if (groupA.tokens.size < MIN_TOKEN_COUNT || groupB.tokens.size < MIN_TOKEN_COUNT) {
        continue;
      }

      // Check cross-source eligibility: union of source names must be >= 2
      const allSources = new Set<string>();
      for (const sourceName of groupA.sourceMap.keys()) {
        allSources.add(sourceName);
      }
      for (const sourceName of groupB.sourceMap.keys()) {
        allSources.add(sourceName);
      }
      if (allSources.size < 2) {
        continue;
      }

      // Compute Jaccard similarity
      const score = jaccardSimilarity(groupA.tokens, groupB.tokens);
      if (score < FUZZY_THRESHOLD) {
        continue;
      }

      // Track the best pair (highest score)
      if (!best || score > best.score) {
        best = { i, j, score };
      }
    }
  }

  return best;
}

/**
 * Merge two MergeGroups into one.
 * Uses the display name from the first group (earlier in the array).
 * Combines all source maps from both groups.
 */
function mergeTwoGroups(first: MergeGroup, second: MergeGroup): MergeGroup {
  // Start with a copy of the first group's source map
  const combinedSourceMap = new Map<string, SourceGroup>(first.sourceMap);

  // Merge in the second group's source groups
  for (const [sourceName, sourceGroup] of second.sourceMap) {
    const existing = combinedSourceMap.get(sourceName);
    if (existing) {
      // Same source exists in both groups — combine download links
      existing.downloadLinks.push(...sourceGroup.downloadLinks);
    } else {
      combinedSourceMap.set(sourceName, sourceGroup);
    }
  }

  return {
    canonicalName: first.canonicalName,
    displayName: first.displayName,
    tokens: first.tokens,
    sourceMap: combinedSourceMap,
  };
}
