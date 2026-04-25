import * as fs from 'fs';
import * as readline from 'readline';
import { readConfig, writeConfig, resolveDownloadDir } from './auth';

// ANSI color helpers
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

export interface InitOptions {
  /** Injected prompt function for testability */
  promptFn?: (question: string) => Promise<string>;
}

function defaultPromptFn(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Validate that a directory exists or can be created, and is writable.
 * Returns null on success, or an error message string on failure.
 */
function validateDirectory(dirPath: string): string | null {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    return `Directory does not exist and cannot be created: ${dirPath}`;
  }
  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
  } catch {
    return `Directory is not writable: ${dirPath}`;
  }
  return null;
}

/**
 * Run the interactive setup wizard.
 * Prompts for a game directory that is used for both downloads and library scanning.
 * Validates the path and persists to config.
 */
export async function runInit(options?: InitOptions): Promise<void> {
  const ask = options?.promptFn ?? defaultPromptFn;
  const config = readConfig() as Record<string, unknown>;

  console.log('');
  console.log(bold(cyan('  switper init')));
  console.log(dim('  Configure your settings'));
  console.log('');

  // --- Game directory (used for both downloads and library scanning) ---
  const currentDir = (config.downloadDir as string) || (config.libraryDir as string) || process.cwd();
  let gameDir: string | undefined;

  while (!gameDir) {
    const answer = await ask(green(`  Game directory`) + dim(` (${currentDir})`) + green(': '));
    const raw = answer || currentDir;
    const resolved = resolveDownloadDir(raw);
    const error = validateDirectory(resolved);
    if (error) {
      console.log(red(`  ${error}`));
    } else {
      gameDir = resolved;
    }
  }

  // --- Persist settings (same directory for both) ---
  config.downloadDir = gameDir;
  config.libraryDir = gameDir;
  writeConfig(config as any);

  // --- Confirmation summary ---
  console.log('');
  console.log(green('  Settings saved!'));
  console.log('');
  console.log(`  Game directory: ${bold(gameDir)}`);
  console.log(dim('  Downloads and update checks will use this directory.'));
  console.log('');
}
