import * as fs from 'fs';
import * as readline from 'readline';
import { readConfig, writeConfig, resolveDownloadDir } from './auth';

// ANSI color helpers
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
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
 * Validate that a download directory exists or can be created, and is writable.
 * Returns null on success, or an error message string on failure.
 */
function validateDownloadDir(dirPath: string): string | null {
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
 * Validate that a game library directory exists and is readable.
 * Returns null on success, or an error message string on failure.
 */
function validateLibraryDir(dirPath: string): string | null {
  try {
    fs.accessSync(dirPath, fs.constants.R_OK);
  } catch {
    return `Directory does not exist or is not readable: ${dirPath}`;
  }
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return `Path is not a directory: ${dirPath}`;
    }
  } catch {
    return `Cannot read directory: ${dirPath}`;
  }
  return null;
}

/**
 * Run the interactive setup wizard.
 * Prompts for download directory and game library directory.
 * Validates paths and persists to config.
 */
export async function runInit(options?: InitOptions): Promise<void> {
  const ask = options?.promptFn ?? defaultPromptFn;
  const config = readConfig() as Record<string, unknown>;

  console.log('');
  console.log(bold(cyan('  switper init')));
  console.log(dim('  Configure your settings'));
  console.log('');

  // --- Download directory ---
  const downloadDefault = (config.downloadDir as string) || process.cwd();
  let downloadDir: string | undefined;

  while (!downloadDir) {
    const answer = await ask(green(`  Download directory`) + dim(` (${downloadDefault})`) + green(': '));
    const raw = answer || downloadDefault;
    const resolved = resolveDownloadDir(raw);
    const error = validateDownloadDir(resolved);
    if (error) {
      console.log(red(`  ${error}`));
    } else {
      downloadDir = resolved;
    }
  }

  // --- Game library directory ---
  const libraryDefault = (config.libraryDir as string) || '';
  let libraryDir: string | undefined;

  while (!libraryDir) {
    const defaultHint = libraryDefault ? dim(` (${libraryDefault})`) : '';
    const answer = await ask(green(`  Game library directory`) + defaultHint + green(': '));
    const raw = answer || libraryDefault;

    if (!raw) {
      console.log(red('  A game library directory is required.'));
      continue;
    }

    const resolved = resolveDownloadDir(raw);
    const error = validateLibraryDir(resolved);
    if (error) {
      console.log(red(`  ${error}`));
    } else {
      libraryDir = resolved;
    }
  }

  // --- Persist settings ---
  config.downloadDir = downloadDir;
  config.libraryDir = libraryDir;
  writeConfig(config as any);

  // --- Confirmation summary ---
  console.log('');
  console.log(green('  Settings saved!'));
  console.log('');
  console.log(`  Download directory:     ${bold(downloadDir)}`);
  console.log(`  Game library directory: ${bold(libraryDir)}`);
  console.log('');
}
