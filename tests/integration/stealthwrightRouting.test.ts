import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TARGET_SOURCES } from '../../src/sources';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn().mockResolvedValue({ data: '<html><body></body></html>' }),
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
import { fetchSource } from '../../src/fetcher';

const mockedAxios = vi.mocked(axios);
const mockedStealthwright = vi.mocked(stealthwright);

describe('Stealthwright Routing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockPage = {
      goto: vi.fn(),
      content: vi.fn().mockResolvedValue('<html><body></body></html>'),
    };
    const newPage = vi.fn().mockResolvedValue(mockPage);
    const mockBrowser = { defaultBrowserContext: () => ({ newPage }), close: vi.fn() };
    const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);
    mockedStealthwright.mockReturnValue({ launch: mockLaunch } as any);
  });

  it('should use Axios for all current sources (none require JS)', async () => {
    // All current sources (notUltraNX) use static fetch
    for (const source of TARGET_SOURCES) {
      vi.clearAllMocks();
      expect(source.requiresJs).toBe(false);
      await fetchSource(source);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedStealthwright).not.toHaveBeenCalled();
    }
  });

  it('should route each TARGET_SOURCE to the correct fetch method', async () => {
    for (const source of TARGET_SOURCES) {
      vi.clearAllMocks();

      const mockPage = {
        goto: vi.fn(),
        content: vi.fn().mockResolvedValue('<html><body></body></html>'),
      };
      const newPage = vi.fn().mockResolvedValue(mockPage);
      const mockBrowser = { defaultBrowserContext: () => ({ newPage }), close: vi.fn() };
      const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);
      mockedStealthwright.mockReturnValue({ launch: mockLaunch } as any);

      await fetchSource(source);

      if (source.requiresJs) {
        expect(mockedStealthwright).toHaveBeenCalled();
        expect(mockedAxios.get).not.toHaveBeenCalled();
      } else {
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(mockedStealthwright).not.toHaveBeenCalled();
      }
    }
  });
});
