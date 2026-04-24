import axios from 'axios';
import { Source } from './types';
import { startSpinner, stopSpinner } from './progress';

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface PingResult {
  source: Source;
  up: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

/**
 * Perform a HEAD request to source.url with 5s timeout.
 * If HEAD returns 405 or 501, retry with GET (same timeout).
 * Returns PingResult.
 */
export async function pingSource(source: Source): Promise<PingResult> {
  const start = Date.now();

  try {
    // Try HEAD first
    const response = await axios.head(source.url, {
      timeout: 5000,
      validateStatus: () => true, // Don't throw on any status
    });

    // If HEAD returns 405 or 501, fall back to GET
    if (response.status === 405 || response.status === 501) {
      const getResponse = await axios.get(source.url, {
        timeout: 5000,
        validateStatus: () => true,
      });
      const elapsed = Date.now() - start;

      if (getResponse.status >= 200 && getResponse.status < 400) {
        return { source, up: true, statusCode: getResponse.status, responseTimeMs: elapsed, error: null };
      }
      return { source, up: false, statusCode: getResponse.status, responseTimeMs: null, error: `HTTP ${getResponse.status}` };
    }

    const elapsed = Date.now() - start;

    if (response.status >= 200 && response.status < 400) {
      return { source, up: true, statusCode: response.status, responseTimeMs: elapsed, error: null };
    }
    return { source, up: false, statusCode: response.status, responseTimeMs: null, error: `HTTP ${response.status}` };
  } catch (err: any) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return { source, up: false, statusCode: null, responseTimeMs: null, error: 'Request timed out' };
    }
    if (err.code === 'ECONNREFUSED') {
      return { source, up: false, statusCode: null, responseTimeMs: null, error: 'Connection refused' };
    }
    if (err.code === 'ENOTFOUND') {
      return { source, up: false, statusCode: null, responseTimeMs: null, error: 'DNS resolution failed' };
    }
    const msg = err.message || String(err);
    return { source, up: false, statusCode: null, responseTimeMs: null, error: msg };
  }
}

/**
 * Format a single PingResult into a colored terminal line.
 */
export function formatPingResult(result: PingResult): string {
  if (result.up) {
    return `  ${green('✓')} ${result.source.name} — ${green('UP')} (${result.statusCode}) ${dim(`[${result.responseTimeMs}ms]`)}`;
  }
  return `  ${red('✗')} ${result.source.name} — ${red('DOWN')} (${result.error})`;
}

/**
 * Format the summary line.
 */
export function formatPingSummary(results: PingResult[]): string {
  const upCount = results.filter(r => r.up).length;
  return `Ping complete: ${upCount}/${results.length} sources reachable`;
}

/**
 * Run ping checks against all sources sequentially, showing a spinner
 * for each, then print the summary.
 */
export async function runPingCommand(sources: Source[]): Promise<void> {
  console.log('');
  const results: PingResult[] = [];

  for (const source of sources) {
    startSpinner(source.name, 'pinging...');
    const result = await pingSource(source);
    const icon = result.up ? green('✓') : red('✗');
    stopSpinner(icon, source.name, result.up ? 'reachable' : 'unreachable');
    console.log(formatPingResult(result));
    results.push(result);
  }

  console.log('');
  console.log(`  ${formatPingSummary(results)}`);
  console.log('');
}
