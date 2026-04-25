const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

/**
 * Format a byte count as a human-readable string.
 * Examples: "0 B", "512 B", "1.2 KB", "128.5 MB", "2.3 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format seconds as a human-readable ETA string.
 * Examples: "0s", "14s", "2m 30s", "1h 5m"
 */
export function formatEta(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) {
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

const BAR_WIDTH = 20;

/**
 * Build the progress line string (pure — no I/O).
 *
 * Known-size format:
 *   ⬇ [████████░░░░░░░░░░░░] 42% 128.5 MB / 305.2 MB  12.3 MB/s  ETA 14s
 *
 * Unknown-size format (totalBytes is null):
 *   ⬇ 128.5 MB  12.3 MB/s
 */
export function buildProgressLine(
  bytesDownloaded: number,
  totalBytes: number | null,
  speedBytesPerSec: number,
): string {
  const dlStr = formatBytes(bytesDownloaded);
  const speedStr = `${formatBytes(speedBytesPerSec)}/s`;

  if (totalBytes == null || totalBytes <= 0) {
    return `  ⬇ ${dlStr}  ${speedStr}`;
  }

  const fraction = Math.min(bytesDownloaded / totalBytes, 1);
  const pct = Math.round(fraction * 100);
  const filled = Math.round(fraction * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const totalStr = formatBytes(totalBytes);

  const remaining = totalBytes - bytesDownloaded;
  const etaSec = speedBytesPerSec > 0 ? remaining / speedBytesPerSec : 0;
  const etaStr = formatEta(etaSec);

  return `  ⬇ [${bar}] ${pct}% ${dlStr} / ${totalStr}  ${speedStr}  ETA ${etaStr}`;
}

/**
 * Options for creating a progress bar.
 */
export interface ProgressBarOptions {
  /** Total bytes expected (null if unknown). */
  totalBytes: number | null;
  /** Minimum interval between redraws in ms (default: 250). */
  updateIntervalMs?: number;
}

/**
 * Create a throttled progress bar renderer.
 *
 * - `update()` can be called on every data chunk; redraws are throttled
 *   to `updateIntervalMs` (default 250 ms).
 * - `finish()` writes the completion line followed by a newline.
 */
export function createProgressBar(options: ProgressBarOptions): {
  update(bytesDownloaded: number, speedBytesPerSec: number): void;
  finish(totalBytes: number, filePath: string): void;
} {
  const interval = options.updateIntervalMs ?? 250;
  let lastWrite = 0;

  function update(bytesDownloaded: number, speedBytesPerSec: number): void {
    const now = Date.now();
    if (now - lastWrite < interval) return;
    lastWrite = now;

    const line = buildProgressLine(bytesDownloaded, options.totalBytes, speedBytesPerSec);
    process.stdout.write(`\r\x1b[K${line}`);
  }

  function finish(totalBytes: number, filePath: string): void {
    const sizeStr = formatBytes(totalBytes);
    process.stdout.write(`\r\x1b[K  ${green('✓')} Downloaded ${sizeStr} → ${filePath}\n`);
  }

  return { update, finish };
}
