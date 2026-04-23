import Table from 'cli-table3';
import { GameEntry } from './types';

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + "...";
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

export function formatResults(entries: GameEntry[], errors: string[]): string {
  if (entries.length === 0) {
    const parts: string[] = ['No .nsp files were found on any source.'];
    if (errors.length > 0) {
      parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
    }
    return parts.join('\n');
  }

  const table = new Table({
    head: ['#', 'Game Name', 'Source', 'Download URL'],
  });

  for (const entry of entries) {
    table.push([
      entry.index,
      truncate(entry.gameName, 50),
      entry.sourceName,
      truncate(entry.downloadUrl, 80),
    ]);
  }

  const parts: string[] = [buildSummary(entries), '', table.toString()];

  if (errors.length > 0) {
    parts.push('', 'Errors:', ...errors.map(e => `  - ${e}`));
  }

  return parts.join('\n');
}
