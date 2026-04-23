import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source } from '../src/types';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
    },
  };
});
vi.mock('puppeteer');

import axios, { AxiosError, AxiosHeaders } from 'axios';
import puppeteer from 'puppeteer';
import { fetchSource, buildErrorMessage } from '../src/fetcher';

const mockedAxios = vi.mocked(axios);
const mockedPuppeteer = vi.mocked(puppeteer);

function makeHttpError(status: number): AxiosError {
  const err = new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    { status, statusText: String(status), data: '', headers: {}, config: { headers: new AxiosHeaders() } } as any,
  );
  return err;
}

function makeCodeError(code: string, message: string): AxiosError {
  return new AxiosError(message, code);
}

describe('fetchSource', () => {
  const staticSource: Source = { url: 'https://example.com', name: 'Example', requiresJs: false };
  const jsSource: Source = { url: 'https://js-example.com', name: 'JsExample', requiresJs: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use axios (static fetch) when requiresJs is false and return html', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: '<html>static</html>' });
    const result = await fetchSource(staticSource);
    expect(mockedAxios.get).toHaveBeenCalledWith(staticSource.url, { timeout: 30000 });
    expect(result).toEqual({ source: staticSource, html: '<html>static</html>', error: null });
  });

  it('should use puppeteer (browser fetch) when requiresJs is true and return html', async () => {
    const mockContent = '<html>rendered</html>';
    const mockPage = { goto: vi.fn(), content: vi.fn().mockResolvedValue(mockContent) };
    const mockBrowser = { newPage: vi.fn().mockResolvedValue(mockPage), close: vi.fn() };
    mockedPuppeteer.launch = vi.fn().mockResolvedValue(mockBrowser);

    const result = await fetchSource(jsSource);
    expect(mockedPuppeteer.launch).toHaveBeenCalledWith({ headless: true });
    expect(mockPage.goto).toHaveBeenCalledWith(jsSource.url, { waitUntil: 'networkidle2', timeout: 30000 });
    expect(result).toEqual({ source: jsSource, html: mockContent, error: null });
  });

  it('should return descriptive error for HTTP 404', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(makeHttpError(404));
    const result = await fetchSource(staticSource);
    expect(result.html).toBeNull();
    expect(result.error).toBe('HTTP error 404 fetching https://example.com');
  });

  it('should return descriptive error for HTTP 500', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(makeHttpError(500));
    const result = await fetchSource(staticSource);
    expect(result.error).toBe('HTTP error 500 fetching https://example.com');
  });

  it('should return timeout error for ECONNABORTED', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(makeCodeError('ECONNABORTED', 'timeout of 30000ms exceeded'));
    const result = await fetchSource(staticSource);
    expect(result.error).toBe('Request timed out fetching https://example.com');
  });

  it('should return connection failed error for ECONNREFUSED', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(makeCodeError('ECONNREFUSED', 'connect ECONNREFUSED'));
    const result = await fetchSource(staticSource);
    expect(result.error).toBe('Connection failed fetching https://example.com: ECONNREFUSED');
  });

  it('should return connection failed error for ENOTFOUND', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(makeCodeError('ENOTFOUND', 'getaddrinfo ENOTFOUND'));
    const result = await fetchSource(staticSource);
    expect(result.error).toBe('Connection failed fetching https://example.com: ENOTFOUND');
  });

  it('should return error with URL for puppeteer failures', async () => {
    mockedPuppeteer.launch = vi.fn().mockRejectedValue(new Error('Browser crashed'));
    const result = await fetchSource(jsSource);
    expect(result.error).toBe('Error fetching https://js-example.com: Browser crashed');
  });

  it('should handle non-Error thrown values with URL', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue('string error');
    const result = await fetchSource(staticSource);
    expect(result.error).toBe('Error fetching https://example.com: string error');
  });
});

describe('buildErrorMessage', () => {
  const url = 'https://test.com';

  it('should include status code and URL for HTTP errors', () => {
    const msg = buildErrorMessage(makeHttpError(404), url);
    expect(msg).toBe('HTTP error 404 fetching https://test.com');
    expect(msg).toContain('404');
    expect(msg).toContain(url);
  });

  it('should handle timeout errors', () => {
    const msg = buildErrorMessage(makeCodeError('ECONNABORTED', 'timeout of 30000ms exceeded'), url);
    expect(msg).toBe('Request timed out fetching https://test.com');
  });

  it('should handle connection refused errors', () => {
    const msg = buildErrorMessage(makeCodeError('ECONNREFUSED', 'connect ECONNREFUSED'), url);
    expect(msg).toBe('Connection failed fetching https://test.com: ECONNREFUSED');
  });

  it('should handle generic Error with URL', () => {
    const msg = buildErrorMessage(new Error('something broke'), url);
    expect(msg).toBe('Error fetching https://test.com: something broke');
    expect(msg).toContain(url);
  });

  it('should handle string errors with URL', () => {
    const msg = buildErrorMessage('oops', url);
    expect(msg).toBe('Error fetching https://test.com: oops');
    expect(msg).toContain(url);
  });
});
