import { describe, it, expect, vi, afterEach } from 'vitest';
import { Source } from '../src/types';
import {
  reportFetching,
  reportParsing,
  reportComplete,
  reportExtractingLinks,
  reportFetchingDetails,
  reportExtractingDownloads,
} from '../src/progress';

const source: Source = { url: 'https://example.com', name: 'TestSource', requiresJs: false };

describe('progress reporter', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    spy?.mockRestore();
  });

  it('reportFetching writes source name', () => {
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    reportFetching(source);
    const output = spy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('TestSource');
    expect(output).toContain('fetching');
  });

  it('reportParsing writes source name', () => {
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    reportParsing(source);
    const output = spy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('TestSource');
    expect(output).toContain('parsing');
  });

  it('reportComplete writes done message', () => {
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    reportComplete();
    const output = spy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('Done');
  });

  it('reportExtractingLinks writes source name', () => {
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    reportExtractingLinks(source);
    const output = spy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('TestSource');
    expect(output).toContain('extracting game links');
  });

  it('reportFetchingDetails writes source name and count', () => {
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    reportFetchingDetails(source, 5);
    const output = spy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('TestSource');
    expect(output).toContain('5 detail pages');
  });

  it('reportExtractingDownloads writes source name', () => {
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    reportExtractingDownloads(source);
    const output = spy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('TestSource');
    expect(output).toContain('extracting downloads');
  });
});
