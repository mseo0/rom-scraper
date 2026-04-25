import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const CONFIG_PATH = path.join(os.homedir(), '.rom-scraper.json');
const ULTRANX_API = 'https://api.ultranx.ru';

interface Config {
  ultranx?: {
    username: string;
    password: string;
  };
  validate?: boolean;
  downloadDir?: string;
}

let cachedToken: string | null = null;

export function readConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  fs.chmodSync(CONFIG_PATH, 0o600);
}

function askQuestion(question: string): Promise<string> {
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

async function loginUltraNX(username: string, password: string): Promise<string | null> {
  try {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const response = await axios.post(`${ULTRANX_API}/auth/login`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    return response.data?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a download directory path to an absolute path.
 * Expands ~ to os.homedir(). Returns the resolved absolute path.
 */
export function resolveDownloadDir(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    inputPath = path.join(os.homedir(), inputPath.slice(1));
  }
  return path.resolve(inputPath);
}

/**
 * Get the effective download directory from config, flag, or default.
 * Priority: flagValue > config.downloadDir > process.cwd()
 */
export function getDownloadDir(flagValue?: string): string {
  if (flagValue) {
    return resolveDownloadDir(flagValue);
  }
  const config = readConfig();
  if (config.downloadDir) {
    return config.downloadDir;
  }
  return process.cwd();
}

/**
 * Ensure we have notUltraNX credentials. Prompts interactively on first use.
 * Returns the access token, or null if auth fails/skipped.
 */
export async function getUltraNXToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  const config = readConfig();

  if (config.ultranx?.username && config.ultranx?.password) {
    const token = await loginUltraNX(config.ultranx.username, config.ultranx.password);
    if (token) {
      cachedToken = token;
      return token;
    }
    // Saved credentials are bad — fall through to prompt
    console.log('\x1b[33m  Saved notUltraNX credentials are invalid.\x1b[0m');
  }

  // Interactive prompt
  console.log('');
  console.log('\x1b[33m  notUltraNX requires a free account for downloads.\x1b[0m');
  console.log('\x1b[2m  Register at: https://not.ultranx.ru/en/register\x1b[0m');
  console.log('\x1b[2m  Credentials saved to ~/.rom-scraper.json (chmod 600)\x1b[0m');
  console.log('');

  const username = await askQuestion('\x1b[36m  Username: \x1b[0m');
  if (!username) return null;

  const password = await askQuestion('\x1b[36m  Password: \x1b[0m');
  if (!password) return null;

  const token = await loginUltraNX(username, password);
  if (!token) {
    console.log('\x1b[31m  Login failed. Check your credentials.\x1b[0m');
    return null;
  }

  config.ultranx = { username, password };
  writeConfig(config);
  console.log('\x1b[32m  Logged in and credentials saved.\x1b[0m');
  console.log('');

  cachedToken = token;
  return token;
}
