// ANSI colors
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL = 80; // ms

let timer: ReturnType<typeof setInterval> | null = null;
let frameIndex: number = 0;

/**
 * Write a status line to stdout, overwriting the current line.
 * Does NOT append a newline — the caller decides when to finalize.
 */
function writeLine(icon: string, source: string, action: string, detail?: string): void {
  const parts = [`  ${icon} ${cyan(source)} ${dim('→')} ${action}`];
  if (detail) parts[0] += ` ${dim(detail)}`;
  process.stdout.write(`\r\x1b[K${parts[0]}`);
}

/**
 * Start an animated spinner on the current terminal line.
 * If a previous spinner is still running, it is stopped first (no newline).
 */
export function startSpinner(source: string, action: string, detail?: string): void {
  // Stop any existing spinner without writing a newline
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  frameIndex = 0;

  // Write the first frame immediately
  writeLine(cyan(SPINNER[0]), source, action, detail);
  frameIndex = 1;

  timer = setInterval(() => {
    const char = SPINNER[frameIndex % SPINNER.length];
    writeLine(cyan(char), source, action, detail);
    frameIndex++;
  }, FRAME_INTERVAL);
}

/**
 * Stop the active spinner and write a final settled line followed by \n.
 * If no spinner is active, just writes the final line.
 */
export function stopSpinner(finalIcon: string, source: string, action: string, detail?: string): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  writeLine(finalIcon, source, action, detail);
  process.stdout.write('\n');
}

/**
 * Write the "Done" line. Ensures any active spinner is stopped first.
 */
export function reportComplete(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  process.stdout.write(`\r\x1b[K  ${green('✓')} ${green('Done')}\n`);
}
