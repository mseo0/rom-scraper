import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Source } from '../../src/types';
import { TARGET_SOURCES } from '../../src/sources';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn().mockResolvedValue({ data: '<html><body><a href="https://example.com/game.nsp">Game</a></body></html>' }),
    },
  };
});

vi.mock('puppeteer', () => {
  const mockPage = {
    goto: vi.fn(),
    content: vi.fn().mockResolvedValue('<html><body><a href="https://example.com/game.nsp">Game</a></body></html>'),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn(),
  };
  return {
    default: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  };
});

import axios from 'axios';
import puppeteer from 'puppeteer';
import { fetchSource } from '../../src/fetcher';

const mockedAxios = vi.mocked(axios);
const mockedPuppeteer = vi.mocked(puppeteer);

describe('Puppeteer Routing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use Puppeteer for FMHY (requiresJs: true)', async () => {
    const fmhy = TARGET_SOURCES.find((s) => s.name === 'FMHY')!;
    expect(fmhy.requiresJs).toBe(true);

    await fetchSource(fmhy);

    expect(mockedPuppeteer.launch).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should use Axios for sources with requiresJs: false', async () => {
    const staticSources = TARGET_SOURCES.filter((s) => !s.requiresJs);
    expect(staticSources.length).toBeGreaterThan(0);

    for (const source of staticSources) {
      vi.clearAllMocks();
      await fetchSource(source);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(source.url, { timeout: 30000 });
      expect(mockedPuppeteer.launch).not.toHaveBeenCalled();
    }
  });

  it('should route each TARGET_SOURCE to the correct fetch method', async () => {
    for (const source of TARGET_SOURCES) {
      vi.clearAllMocks();
      await fetchSource(source);

      if (source.requiresJs) {
        expect(mockedPuppeteer.launch).toHaveBeenCalledTimes(1);
        expect(mockedAxios.get).not.toHaveBeenCalled();
      } else {
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(mockedPuppeteer.launch).not.toHaveBeenCalled();
      }
    }
  });
});
