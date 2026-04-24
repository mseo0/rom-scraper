import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockContent = vi.fn();
const mockGoto = vi.fn();
const mockNewPage = vi.fn();
const mockClose = vi.fn();
const mockLaunch = vi.fn();

vi.mock('stealthwright', () => ({
  stealthwright: vi.fn(() => ({
    launch: mockLaunch,
  })),
}));

import { fetchWithBrowser } from '../src/fetcher';
import { stealthwright } from 'stealthwright';

const mockedStealthwright = vi.mocked(stealthwright);

describe('fetchWithBrowser', () => {
  const testUrl = 'https://example.com/page';
  const testHtml = '<html><body>Hello</body></html>';

  beforeEach(() => {
    vi.clearAllMocks();

    mockContent.mockResolvedValue(testHtml);
    mockGoto.mockResolvedValue(undefined);
    mockNewPage.mockResolvedValue({ goto: mockGoto, content: mockContent });
    mockClose.mockResolvedValue(undefined);
    mockLaunch.mockResolvedValue({
      defaultBrowserContext: () => ({ newPage: mockNewPage }),
      close: mockClose,
    });
  });

  it('should call stealthwright().launch({ headless: true })', async () => {
    await fetchWithBrowser(testUrl);

    expect(mockedStealthwright).toHaveBeenCalled();
    expect(mockLaunch).toHaveBeenCalledWith({ headless: true });
  });

  it('should call browser.defaultBrowserContext() and context.newPage()', async () => {
    await fetchWithBrowser(testUrl);

    expect(mockNewPage).toHaveBeenCalled();
  });

  it('should call page.goto with the URL, waitUntil networkidle0, and timeout 30000', async () => {
    await fetchWithBrowser(testUrl);

    expect(mockGoto).toHaveBeenCalledWith(testUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
  });

  it('should call page.content() and return its value', async () => {
    const result = await fetchWithBrowser(testUrl);

    expect(mockContent).toHaveBeenCalled();
    expect(result).toBe(testHtml);
  });

  it('should call browser.close() on success', async () => {
    await fetchWithBrowser(testUrl);

    expect(mockClose).toHaveBeenCalled();
  });

  it('should call browser.close() even when page.goto throws', async () => {
    mockGoto.mockRejectedValue(new Error('Navigation timeout'));

    await expect(fetchWithBrowser(testUrl)).rejects.toThrow('Navigation timeout');
    expect(mockClose).toHaveBeenCalled();
  });

  it('should propagate the error from page.goto to the caller', async () => {
    const error = new Error('net::ERR_CONNECTION_REFUSED');
    mockGoto.mockRejectedValue(error);

    await expect(fetchWithBrowser(testUrl)).rejects.toThrow('net::ERR_CONNECTION_REFUSED');
  });
});
