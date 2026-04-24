import { execSync } from 'child_process';

/**
 * Result of a clipboard write attempt.
 * On success: { success: true }
 * On failure: { success: false, error: string }
 */
export type ClipboardResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Write the given text to the system clipboard.
 *
 * Platform detection:
 * - darwin  → pbcopy
 * - linux   → xclip -selection clipboard, fallback xsel --clipboard --input
 * - win32   → clip
 *
 * Returns a ClipboardResult indicating success or a descriptive error.
 */
export function copyToClipboard(text: string): ClipboardResult {
  const platform = process.platform;

  switch (platform) {
    case 'darwin':
      return runClipboardCommand('pbcopy', text);

    case 'linux': {
      const xclipResult = runClipboardCommand('xclip -selection clipboard', text);
      if (xclipResult.success) {
        return xclipResult;
      }
      return runClipboardCommand('xsel --clipboard --input', text);
    }

    case 'win32':
      return runClipboardCommand('clip', text);

    default:
      return {
        success: false,
        error: `Clipboard is not supported on platform "${platform}". Please copy the URL manually.`,
      };
  }
}

function runClipboardCommand(command: string, text: string): ClipboardResult {
  try {
    execSync(command, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `${command} failed: ${message}`,
    };
  }
}
