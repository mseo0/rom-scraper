import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { startSpinner, stopSpinner } from './progress';

const execFileAsync = promisify(execFile);

// ── Interfaces ──────────────────────────────────────────────────────────

export interface DecompressResult {
  success: true;
  nspPath: string;
}

export interface DecompressError {
  success: false;
  error: string;
  exitCode?: number;
}

export interface DecompressSkipped {
  success: false;
  error: string;
  notInstalled: true;
}

export type DecompressOutcome = DecompressResult | DecompressError | DecompressSkipped;

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Check if a file path has the `.nsz` extension (case-insensitive).
 */
export function isNszFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.nsz';
}

/**
 * Check whether the `nsz` CLI tool is available on the system PATH.
 * Uses `which` on Unix and `where` on Windows.
 */
async function isNszInstalled(): Promise<boolean> {
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFileAsync(command, ['nsz']);
    return true;
  } catch {
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────

/**
 * Decompress an `.nsz` file using `nsz -D`.
 *
 * - Checks if `nsz` is on PATH before attempting.
 * - Shows a spinner during decompression (using existing startSpinner/stopSpinner).
 * - Returns the path to the resulting `.nsp` file on success.
 * - On non-zero exit, returns an error and preserves the original `.nsz` file.
 */
export async function decompressNsz(filePath: string): Promise<DecompressOutcome> {
  // 1. Check nsz availability
  const installed = await isNszInstalled();
  if (!installed) {
    return {
      success: false,
      error: 'nsz is not installed — skipping decompression',
      notInstalled: true,
    } satisfies DecompressSkipped;
  }

  // 2. Derive expected output path (.nsz → .nsp)
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const nspPath = path.join(dir, `${base}.nsp`);

  // 3. Run decompression with spinner
  const fileName = path.basename(filePath);
  startSpinner('nsz', 'Decompressing', fileName);

  try {
    await execFileAsync('nsz', ['-D', filePath]);
    stopSpinner('✓', 'nsz', 'Decompressed', nspPath);
    return { success: true, nspPath } satisfies DecompressResult;
  } catch (err: unknown) {
    const exitCode = isExecError(err) ? err.code : undefined;
    const message = err instanceof Error ? err.message : String(err);
    stopSpinner('✗', 'nsz', 'Decompression failed', fileName);
    return {
      success: false,
      error: message,
      exitCode: typeof exitCode === 'number' ? exitCode : undefined,
    } satisfies DecompressError;
  }
}

// ── Internal type guard ─────────────────────────────────────────────────

interface ExecError extends Error {
  code: number;
}

function isExecError(err: unknown): err is ExecError {
  return err instanceof Error && typeof (err as ExecError).code === 'number';
}
