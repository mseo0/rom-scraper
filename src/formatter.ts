import { GameEntry } from './types';
import { DownloadLink } from './fileHosts';

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + "...";
}

/**
 * Get an icon for a pack label.
 */
function getPackIcon(label: string): string {
  if (label.includes('Base')) return '[base]';
  if (label.includes('Update')) return '[update]';
  if (label.includes('Full')) return '[full]';
  if (label.includes('DLC')) return '[dlc]';
  return '[download]';
}

/**
 * Format the download list for a GameEntry using a plain console layout.
 * Uses the hostName field which is set to the pack label by the orchestrator.
 */
function formatDownloadLines(entry: GameEntry): string[] {
  if (entry.downloadLinks && entry.downloadLinks.length > 0) {
    return entry.downloadLinks
      .map((link: DownloadLink) => {
        const icon = getPackIcon(link.hostName);
        return `  ${icon} ${link.hostName}: \x1b[2m${link.url}\x1b[0m`;
      });
  }
  return [`  [download] Download: \x1b[2m${entry.downloadUrl}\x1b[0m`];
}

function formatEntry(entry: GameEntry): string {
  return [
    `${entry.index}. ${truncate(entry.gameName, 50)}`,
    `   Source: ${entry.sourceName}`,
    '   Downloads:',
    ...formatDownloadLines(entry),
  ].join('\n');
}

function formatEntries(entries: GameEntry[]): string {
  return entries.map(formatEntry).join('\n\n');
}

export function buildSummary(entries: GameEntry[]): string {
  const total = entries.length;
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.sourceName, (counts.get(entry.sourceName) ?? 0) + 1);
  }
  const sourceCount = counts.size;
  const breakdown = Array.from(counts.entries())
    .map(([name, count]) => `${name}: ${count}`)
    .join(' | ');
  return `Found ${total} NSP links across ${sourceCount} sources:\n  ${breakdown}`;
}

export function formatSearchResults(entries: GameEntry[], query: string, errors: string[]): string {
  if (entries.length === 0) {
    const parts: string[] = [`No games found matching '${query}'.`];
    if (errors.length > 0) {
      parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
    }
    return parts.join('\n');
  }

  const parts: string[] = [`Found ${entries.length} result(s) for '${query}':`, '', formatEntries(entries)];

  if (errors.length > 0) {
    parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
  }

  return parts.join('\n');
}

export function formatResults(entries: GameEntry[], errors: string[]): string {
  if (entries.length === 0) {
    const parts: string[] = ['No .nsp files were found on any source.'];
    if (errors.length > 0) {
      parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
    }
    return parts.join('\n');
  }

  const parts: string[] = [buildSummary(entries), '', formatEntries(entries)];

  if (errors.length > 0) {
    parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
  }

  return parts.join('\n');
}
