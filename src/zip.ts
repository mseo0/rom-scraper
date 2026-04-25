import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { startSpinner, stopSpinner } from './progress';

const execFileAsync = promisify(execFile);

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

export interface ExtractResult {
  success: true;
  extractedDir: string;
  files: string[];
}

export interface ExtractError {
  success: false;
  error: string;
}

export type ExtractOutcome = ExtractResult | ExtractError;

/**
 * Check if a file path has the `.zip` extension (case-insensitive).
 */
export function isZipFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.zip';
}

/**
 * Extract a `.zip` file to a directory with the same name (minus extension).
 *
 * Uses the system `unzip` command (available by default on macOS and most Linux).
 * On Windows, falls back to PowerShell's Expand-Archive.
 *
 * Shows a spinner during extraction.
 * Returns the list of extracted file paths on success.
 */
export async function extractZip(filePath: string): Promise<ExtractOutcome> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const extractDir = path.join(dir, base);

  // Create extraction directory
  fs.mkdirSync(extractDir, { recursive: true });

  const fileName = path.basename(filePath);
  startSpinner('zip', 'Extracting', fileName);

  try {
    if (process.platform === 'win32') {
      await execFileAsync('powershell', [
        '-NoProfile', '-Command',
        `Expand-Archive -Path "${filePath}" -DestinationPath "${extractDir}" -Force`,
      ]);
    } else {
      await execFileAsync('unzip', ['-o', filePath, '-d', extractDir]);
    }

    // Collect extracted files
    const files = collectFiles(extractDir);

    stopSpinner(green('✓'), 'zip', 'Extracted', `${files.length} file(s) → ${extractDir}`);
    return { success: true, extractedDir: extractDir, files };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stopSpinner(red('✗'), 'zip', 'Extraction failed', fileName);
    return { success: false, error: message };
  }
}

/**
 * Recursively collect all file paths in a directory.
 */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}
