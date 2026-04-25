import { MergedEntry, SourceGroup } from './types';
import { DownloadLink } from './fileHosts';

/** Structured output from format functions */
export interface FormattedOutput {
  text: string;
  linkMap: Map<number, string>;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + "...";
}

/**
 * Format download link lines for a single SourceGroup.
 * Each line is prefixed with the given string (used for box-drawing alignment).
 * Assigns sequential [N] numbers to each link using the shared counter and linkMap.
 */
function formatSourceDownloadLines(
  sourceGroup: SourceGroup,
  prefix: string,
  counter: { value: number },
  linkMap: Map<number, string>,
): string[] {
  if (sourceGroup.downloadLinks.length > 0) {
    return sourceGroup.downloadLinks.map((link: DownloadLink) => {
      const idx = counter.value;
      counter.value++;
      linkMap.set(idx, link.url);
      return `${prefix}[${idx}] ${link.hostName}: \x1b[2m${truncate(link.url, 70)}\x1b[0m`;
    });
  }
  return [];
}

/**
 * Format a MergedEntry for console output.
 *
 * Single source (1 SourceGroup): backward-compatible format matching the
 * original GameEntry layout.
 *
 * Multiple sources (2+ SourceGroups): box-drawing characters visually
 * distinguish each source section.
 */
function formatEntry(
  entry: MergedEntry,
  counter: { value: number },
  linkMap: Map<number, string>,
): string {
  const heading = `${entry.index}. ${truncate(entry.gameName, 50)}`;

  if (entry.sourceGroups.length === 1) {
    // Single source — backward-compatible format
    const sg = entry.sourceGroups[0];
    const downloadLines = formatSourceDownloadLines(sg, '  ', counter, linkMap);
    if (downloadLines.length === 0) {
      // Fallback when no download links exist
      return [heading, `   Source: ${sg.sourceName}`, '   Downloads:'].join('\n');
    }
    return [
      heading,
      `   Source: ${sg.sourceName}`,
      '   Downloads:',
      ...downloadLines,
    ].join('\n');
  }

  // Multiple sources — box-drawing format
  const lines: string[] = [heading];
  const lastIdx = entry.sourceGroups.length - 1;

  entry.sourceGroups.forEach((sg, i) => {
    const isLast = i === lastIdx;
    const isFirst = i === 0;

    if (isFirst) {
      lines.push(`   ┌ ${sg.sourceName}`);
    } else if (isLast) {
      lines.push(`   └ ${sg.sourceName}`);
    } else {
      lines.push(`   ├ ${sg.sourceName}`);
    }

    const dlPrefix = isLast ? '      ' : '   │  ';
    lines.push(...formatSourceDownloadLines(sg, dlPrefix, counter, linkMap));
  });

  return lines.join('\n');
}

function formatEntries(
  entries: MergedEntry[],
  counter: { value: number },
  linkMap: Map<number, string>,
): string {
  return entries.map(e => formatEntry(e, counter, linkMap)).join('\n\n');
}

export function buildSummary(entries: MergedEntry[]): string {
  const total = entries.length;
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const sg of entry.sourceGroups) {
      counts.set(sg.sourceName, (counts.get(sg.sourceName) ?? 0) + 1);
    }
  }
  const sourceCount = counts.size;
  const breakdown = Array.from(counts.entries())
    .map(([name, count]) => `${name}: ${count}`)
    .join(' | ');
  return `Found ${total} unique games across ${sourceCount} sources:\n  ${breakdown}`;
}

export function formatSearchResults(entries: MergedEntry[], query: string, errors: string[]): FormattedOutput {
  const linkMap = new Map<number, string>();

  if (entries.length === 0) {
    const parts: string[] = [`No games found matching '${query}'.`];
    if (errors.length > 0) {
      parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
    }
    return { text: parts.join('\n'), linkMap };
  }

  const counter = { value: 1 };
  const parts: string[] = [`Found ${entries.length} result(s) for '${query}':`, '', formatEntries(entries, counter, linkMap)];

  if (errors.length > 0) {
    parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
  }

  return { text: parts.join('\n'), linkMap };
}

export function formatResults(entries: MergedEntry[], errors: string[]): FormattedOutput {
  const linkMap = new Map<number, string>();

  if (entries.length === 0) {
    const parts: string[] = ['No .nsp files were found on any source.'];
    if (errors.length > 0) {
      parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
    }
    return { text: parts.join('\n'), linkMap };
  }

  const counter = { value: 1 };
  const parts: string[] = [buildSummary(entries), '', formatEntries(entries, counter, linkMap)];

  if (errors.length > 0) {
    parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
  }

  return { text: parts.join('\n'), linkMap };
}

export function formatNewReleases(entries: MergedEntry[], errors: string[]): FormattedOutput {
  const linkMap = new Map<number, string>();

  if (entries.length === 0) {
    const parts: string[] = ['No new releases found.'];
    if (errors.length > 0) {
      parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
    }
    return { text: parts.join('\n'), linkMap };
  }

  const counter = { value: 1 };
  const parts: string[] = [
    `New Releases — ${entries.length} game(s) found:`,
    '',
    formatEntries(entries, counter, linkMap),
  ];

  if (errors.length > 0) {
    parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
  }

  return { text: parts.join('\n'), linkMap };
}

/**
 * Format a compact game list showing only game names and sources (no links).
 * Used for the first step of the two-step selection UI.
 */
export function formatGameList(entries: MergedEntry[], header: string, errors: string[]): string {
  if (entries.length === 0) {
    const parts: string[] = [header];
    if (errors.length > 0) {
      parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
    }
    return parts.join('\n');
  }

  const lines: string[] = [header, ''];
  for (const entry of entries) {
    const sources = entry.sourceGroups.map(sg => sg.sourceName).join(', ');
    const linkCount = entry.sourceGroups.reduce((sum, sg) => sum + sg.downloadLinks.length, 0);
    lines.push(`  ${entry.index}. ${truncate(entry.gameName, 50)} \x1b[2m(${sources}) [${linkCount} links]\x1b[0m`);
  }

  if (errors.length > 0) {
    lines.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
  }

  return lines.join('\n');
}

/**
 * Format the download links for a single MergedEntry.
 * Returns the display text and a linkMap for clipboard copy.
 * Link numbering starts at 1 for each game.
 */
export function formatGameLinks(entry: MergedEntry): FormattedOutput {
  const linkMap = new Map<number, string>();
  const counter = { value: 1 };
  const lines: string[] = [
    `${bold(truncate(entry.gameName, 60))}`,
    '',
  ];

  for (const sg of entry.sourceGroups) {
    if (entry.sourceGroups.length > 1) {
      lines.push(`  ${sg.sourceName}`);
    }
    for (const link of sg.downloadLinks) {
      const idx = counter.value++;
      linkMap.set(idx, link.url);
      // Show just the host name and domain — no full URL
      let domain = '';
      try { domain = ` \x1b[2m(${new URL(link.url).hostname})\x1b[0m`; } catch { /* ignore */ }
      lines.push(`    [${idx}] ${link.hostName}${domain}`);
    }
  }

  return { text: lines.join('\n'), linkMap };
}

function bold(s: string): string {
  return `\x1b[1m${s}\x1b[0m`;
}
