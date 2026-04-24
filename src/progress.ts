import { Source } from './types';

// ANSI colors
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIdx = 0;

function spin(): string {
  const s = SPINNER[spinnerIdx % SPINNER.length];
  spinnerIdx++;
  return cyan(s);
}

function status(icon: string, source: string, action: string, detail?: string): void {
  const parts = [`  ${icon} ${cyan(source)} ${dim('→')} ${action}`];
  if (detail) parts[0] += ` ${dim(detail)}`;
  process.stdout.write(`\r\x1b[K${parts[0]}\n`);
}

export function reportFetching(source: Source): void {
  const js = source.requiresJs ? dim(' (browser)') : '';
  status(spin(), source.name, 'fetching catalog', js);
}

export function reportParsing(source: Source): void {
  status(spin(), source.name, 'parsing');
}

export function reportComplete(): void {
  process.stdout.write(`\r\x1b[K  ${green('✓')} ${green('Done')}\n`);
}

export function reportExtractingLinks(source: Source): void {
  status(spin(), source.name, 'extracting game links');
}

export function reportFetchingDetails(source: Source, count: number): void {
  status(spin(), source.name, `fetching ${count} detail pages`);
}

export function reportExtractingDownloads(source: Source): void {
  status(spin(), source.name, 'extracting downloads');
}
