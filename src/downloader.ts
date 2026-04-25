import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface DownloadOptions {
  url: string;
  downloadDir: string;
  /** Called periodically with progress data */
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
  speedBytesPerSec: number;
  elapsedMs: number;
}

export interface DownloadResult {
  success: true;
  filePath: string;
  totalBytes: number;
}

export interface DownloadError {
  success: false;
  error: string;
  statusCode?: number;
}

export type DownloadOutcome = DownloadResult | DownloadError;

// ── Filename derivation ─────────────────────────────────────────────────────

/**
 * Parse a Content-Disposition header to extract the filename.
 *
 * Supports:
 *   filename*=UTF-8''encoded%20name.nsp   (RFC 5987)
 *   filename="quoted name.nsp"
 *   filename=unquoted.nsp
 *
 * Returns null if no usable filename is found.
 */
function parseContentDisposition(header: string): string | null {
  // Try filename* first (RFC 5987 extended parameter)
  const extMatch = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)?'[^']*'(.+?)(?:;|$)/i);
  if (extMatch) {
    try {
      const decoded = decodeURIComponent(extMatch[1].trim());
      if (decoded) return decoded;
    } catch {
      // fall through
    }
  }

  // Try quoted filename
  const quotedMatch = header.match(/filename\s*=\s*"([^"]*)"/i);
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1];
  }

  // Try unquoted filename
  const unquotedMatch = header.match(/filename\s*=\s*([^\s;"]+)/i);
  if (unquotedMatch) {
    return unquotedMatch[1];
  }

  return null;
}

/**
 * Sanitize a filename: strip path separators, null bytes, and leading dots.
 * Returns empty string if nothing remains.
 */
function sanitizeFilename(name: string): string {
  let sanitized = name
    .replace(/[\\/]/g, '')     // strip path separators
    .replace(/\0/g, '')        // strip null bytes
    .replace(/^\.+/, '');      // strip leading dots

  return sanitized.trim();
}

/**
 * Derive a filename from the HTTP response headers and URL.
 *
 * Priority:
 *   1. Content-Disposition header (filename* or filename)
 *   2. Last path segment of the URL (before query string)
 *   3. Fallback to "download"
 */
export function deriveFilename(
  url: string,
  contentDisposition?: string | null,
): string {
  // 1. Try Content-Disposition header
  if (contentDisposition) {
    const parsed = parseContentDisposition(contentDisposition);
    if (parsed) {
      const sanitized = sanitizeFilename(parsed);
      if (sanitized) return sanitized;
    }
  }

  // 2. Fall back to last path segment of URL
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(lastSegment);
      } catch {
        decoded = lastSegment;
      }
      const sanitized = sanitizeFilename(decoded);
      if (sanitized) return sanitized;
    }
  } catch {
    // URL parsing failed — fall through
  }

  // 3. Fallback
  return 'download';
}

// ── Filename conflict resolution ────────────────────────────────────────────

/**
 * Resolve filename conflicts by appending a numeric suffix before the extension.
 *
 * If `name` does not conflict with any existing file in `dir`, returns `name`.
 * Otherwise returns `<basename>_<N>.<ext>` where N starts at 1 and increments
 * until a unique name is found.
 *
 * For files without an extension, the suffix is appended at the end.
 */
export function resolveConflict(dir: string, name: string): string {
  let candidate = name;
  let counter = 0;

  while (fs.existsSync(path.join(dir, candidate))) {
    counter++;
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0) {
      const base = name.slice(0, dotIndex);
      const ext = name.slice(dotIndex);
      candidate = `${base}_${counter}${ext}`;
    } else {
      candidate = `${name}_${counter}`;
    }
  }

  return candidate;
}

// ── Download function ───────────────────────────────────────────────────────

/**
 * Download a file via HTTP and save it to the specified directory.
 *
 * - Derives filename from Content-Disposition header, falling back to URL path.
 * - Appends numeric suffix (_1, _2, ...) if file already exists.
 * - Creates downloadDir (including parents) if it doesn't exist.
 * - Streams response to disk (no full-body buffering).
 * - Calls onProgress callback on each chunk with speed and progress data.
 * - Cleans up partial file on error or SIGINT.
 */
export async function downloadFile(options: DownloadOptions): Promise<DownloadOutcome> {
  const { url, downloadDir, onProgress } = options;

  // Ensure download directory exists
  fs.mkdirSync(downloadDir, { recursive: true });

  let filePath: string | null = null;
  let writeStream: fs.WriteStream | null = null;

  // Cleanup handler for partial downloads
  const cleanup = () => {
    if (writeStream) {
      try { writeStream.destroy(); } catch { /* ignore */ }
    }
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  };

  // Register SIGINT handler for partial download cleanup
  const sigintHandler = () => {
    cleanup();
    process.exit(1);
  };
  process.on('SIGINT', sigintHandler);

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000,
      // Allow non-2xx to be handled by axios error path
      validateStatus: (status) => status >= 200 && status < 300,
    });

    // Derive filename
    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    const rawFilename = deriveFilename(url, contentDisposition);
    const finalFilename = resolveConflict(downloadDir, rawFilename);
    filePath = path.join(downloadDir, finalFilename);

    // Parse total bytes from Content-Length
    const contentLength = response.headers['content-length'];
    const totalBytes: number | null = contentLength ? parseInt(String(contentLength), 10) : null;

    // Set up write stream
    writeStream = fs.createWriteStream(filePath);

    // Track progress
    let bytesDownloaded = 0;
    const startTime = Date.now();

    return await new Promise<DownloadOutcome>((resolve, reject) => {
      const stream = response.data as NodeJS.ReadableStream;

      stream.on('data', (chunk: Buffer) => {
        bytesDownloaded += chunk.length;
        const elapsedMs = Date.now() - startTime;
        const elapsedSec = elapsedMs / 1000;
        const speedBytesPerSec = elapsedSec > 0 ? bytesDownloaded / elapsedSec : 0;

        if (onProgress) {
          onProgress({
            bytesDownloaded,
            totalBytes,
            speedBytesPerSec,
            elapsedMs,
          });
        }
      });

      stream.on('error', (err: Error) => {
        cleanup();
        resolve({
          success: false,
          error: err.message || 'Stream error during download',
        });
      });

      writeStream!.on('error', (err: Error) => {
        cleanup();
        resolve({
          success: false,
          error: `Disk write error: ${err.message}`,
        });
      });

      writeStream!.on('finish', () => {
        resolve({
          success: true,
          filePath: filePath!,
          totalBytes: bytesDownloaded,
        });
      });

      stream.pipe(writeStream!);
    });
  } catch (err) {
    cleanup();

    if (err instanceof AxiosError) {
      if (err.response) {
        // HTTP non-2xx response
        return {
          success: false,
          error: `HTTP ${err.response.status}: ${err.response.statusText || 'Request failed'}`,
          statusCode: err.response.status,
        };
      }

      // Network errors
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Download timed out',
        };
      }
      if (err.code === 'ENOTFOUND') {
        return {
          success: false,
          error: `DNS lookup failed for ${new URL(url).hostname}`,
        };
      }
      if (err.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Connection refused by server',
        };
      }

      return {
        success: false,
        error: err.message || 'Network error',
      };
    }

    return {
      success: false,
      error: (err as Error).message || 'Unknown download error',
    };
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
}
