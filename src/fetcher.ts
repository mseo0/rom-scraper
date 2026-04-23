import axios from 'axios';
import puppeteer from 'puppeteer';
import { Source, FetchResult, GameLink, DetailPageResult } from './types';

export async function fetchSource(source: Source): Promise<FetchResult> {
  try {
    const html = source.requiresJs
      ? await fetchWithBrowser(source.url)
      : await fetchStatic(source.url);
    return { source, html, error: null };
  } catch (err: unknown) {
    const message = buildErrorMessage(err, source.url);
    return { source, html: null, error: message };
  }
}

export function buildErrorMessage(err: unknown, url: string): string {
  if (isAxiosError(err)) {
    if (err.response) {
      return `HTTP error ${err.response.status} fetching ${url}`;
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return `Request timed out fetching ${url}`;
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ENETUNREACH' || err.code === 'EHOSTUNREACH') {
      return `Connection failed fetching ${url}: ${err.code}`;
    }
    return `Request failed fetching ${url}: ${err.message}`;
  }
  const errorMsg = err instanceof Error ? err.message : String(err);
  return `Error fetching ${url}: ${errorMsg}`;
}

function isAxiosError(err: unknown): err is import('axios').AxiosError {
  return typeof err === 'object' && err !== null && (err as any).isAxiosError === true;
}

export async function fetchStatic(url: string): Promise<string> {
  const response = await axios.get<string>(url, { timeout: 30000 });
  return response.data;
}

export async function fetchWithBrowser(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

export async function fetchDetailPages(
  gameLinks: GameLink[],
  source: Source,
  concurrencyLimit: number
): Promise<DetailPageResult[]> {
  const results: DetailPageResult[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < gameLinks.length) {
      const currentIndex = index++;
      const gameLink = gameLinks[currentIndex];
      try {
        const html = source.requiresJs
          ? await fetchWithBrowser(gameLink.url)
          : await fetchStatic(gameLink.url);
        results[currentIndex] = { gameLink, html, error: null };
      } catch (err: unknown) {
        const message = buildErrorMessage(err, gameLink.url);
        results[currentIndex] = { gameLink, html: null, error: message };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrencyLimit, gameLinks.length) },
    () => next()
  );
  await Promise.all(workers);

  return results;
}
