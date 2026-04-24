import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source, GameLink } from '../src/types';

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
vi.mock('stealthwright', () => ({
  stealthwright: vi.fn(() => ({
    launch: vi.fn()
  }))
}));

import axios from 'axios';
import { stealthwright } from 'stealthwright';
import { fetchDetailPages } from '../src/fetcher';

const mockedAxios = vi.mocked(axios);
const mockedStealthwright = vi.mocked(stealthwright);

const staticSource: Source = { url: 'https://example.com', name: 'Example', requiresJs: false };
const jsSource: Source = { url: 'https://js-example.com', name: 'JsExample', requiresJs: true };

function makeGameLinks(count: number): GameLink[] {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/game/${i + 1}`,
    title: `Game ${i + 1}`,
  }));
}

describe('fetchDetailPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all results with html and no error when all fetches succeed', async () => {
    const gameLinks = makeGameLinks(3);
    mockedAxios.get = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({ data: `<html>${url}</html>` })
    );

    const results = await fetchDetailPages(gameLinks, staticSource, 3);

    expect(results).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(results[i].gameLink).toEqual(gameLinks[i]);
      expect(results[i].html).toBe(`<html>${gameLinks[i].url}</html>`);
      expect(results[i].error).toBeNull();
    }
  });

  it('should record errors for failures and return html for successes in a mixed scenario', async () => {
    const gameLinks = makeGameLinks(3);
    mockedAxios.get = vi.fn()
      .mockResolvedValueOnce({ data: '<html>page1</html>' })
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: '<html>page3</html>' });

    const results = await fetchDetailPages(gameLinks, staticSource, 3);

    expect(results).toHaveLength(3);
    // First succeeds
    expect(results[0].html).toBe('<html>page1</html>');
    expect(results[0].error).toBeNull();
    // Second fails
    expect(results[1].html).toBeNull();
    expect(results[1].error).toContain(gameLinks[1].url);
    // Third succeeds
    expect(results[2].html).toBe('<html>page3</html>');
    expect(results[2].error).toBeNull();
  });

  it('should record errors for all results when all fetches fail', async () => {
    const gameLinks = makeGameLinks(3);
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('Server down'));

    const results = await fetchDetailPages(gameLinks, staticSource, 3);

    expect(results).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(results[i].gameLink).toEqual(gameLinks[i]);
      expect(results[i].html).toBeNull();
      expect(results[i].error).toBeTruthy();
      expect(results[i].error).toContain(gameLinks[i].url);
    }
  });

  it('should return an empty array for empty game links', async () => {
    const results = await fetchDetailPages([], staticSource, 3);
    expect(results).toEqual([]);
  });

  it('should maintain order matching input game links', async () => {
    const gameLinks = makeGameLinks(5);
    // Add varying delays to simulate out-of-order completion
    mockedAxios.get = vi.fn().mockImplementation((url: string) => {
      return Promise.resolve({ data: `<html>${url}</html>` });
    });

    const results = await fetchDetailPages(gameLinks, staticSource, 2);

    expect(results).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(results[i].gameLink).toEqual(gameLinks[i]);
      expect(results[i].html).toBe(`<html>${gameLinks[i].url}</html>`);
    }
  });

  it('should use axios (static fetch) for non-JS source', async () => {
    const gameLinks = makeGameLinks(1);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: '<html>static</html>' });

    await fetchDetailPages(gameLinks, staticSource, 1);

    expect(mockedAxios.get).toHaveBeenCalledWith(gameLinks[0].url, { timeout: 30000 });
  });

  it('should use stealthwright (browser fetch) for JS source', async () => {
    const gameLinks = makeGameLinks(1);
    const mockPage = { goto: vi.fn(), content: vi.fn().mockResolvedValue('<html>rendered</html>') };
    const newPage = vi.fn().mockResolvedValue(mockPage);
    const mockBrowser = { defaultBrowserContext: () => ({ newPage }), close: vi.fn() };
    const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);
    mockedStealthwright.mockReturnValue({ launch: mockLaunch } as any);

    const results = await fetchDetailPages(gameLinks, jsSource, 1);

    expect(mockedStealthwright).toHaveBeenCalled();
    expect(mockLaunch).toHaveBeenCalledWith({ headless: true });
    expect(mockPage.goto).toHaveBeenCalledWith(gameLinks[0].url, { waitUntil: 'networkidle0', timeout: 30000 });
    expect(results[0].html).toBe('<html>rendered</html>');
    expect(results[0].error).toBeNull();
  });
});
