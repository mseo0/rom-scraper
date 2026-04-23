import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AxiosError, AxiosHeaders } from 'axios';
import { buildErrorMessage } from '../../src/fetcher';

/**
 * **Validates: Requirements 1.3**
 * Feature: nsp-webscraper, Property 6: Error message contains source URL and status code
 *
 * For any HTTP error status code (400–599) and any source URL, the generated
 * error message SHALL contain both the source URL string and the numeric status code.
 */
describe('Property 6: Error message contains source URL and status code', () => {
  /**
   * Creates an AxiosError-like object with the given HTTP status code.
   */
  function makeHttpError(status: number): AxiosError {
    return new AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      { status, statusText: String(status), data: '', headers: {}, config: { headers: new AxiosHeaders() } } as any,
    );
  }

  /** Generates a random HTTP error status code in the range 400–599. */
  const statusCodeArb = fc.integer({ min: 400, max: 599 });

  /** Generates a random URL like "https://{random}.com/{random}". */
  const urlArb = fc
    .tuple(
      fc.stringMatching(/^[a-z]{3,12}$/),
      fc.stringMatching(/^[a-z0-9]{1,20}$/)
    )
    .map(([domain, path]) => `https://${domain}.com/${path}`);

  it('error message should contain the source URL', () => {
    fc.assert(
      fc.property(statusCodeArb, urlArb, (status, url) => {
        const err = makeHttpError(status);
        const message = buildErrorMessage(err, url);
        expect(message).toContain(url);
      }),
      { numRuns: 100 }
    );
  });

  it('error message should contain the status code', () => {
    fc.assert(
      fc.property(statusCodeArb, urlArb, (status, url) => {
        const err = makeHttpError(status);
        const message = buildErrorMessage(err, url);
        expect(message).toContain(String(status));
      }),
      { numRuns: 100 }
    );
  });

  it('error message should contain both URL and status code', () => {
    fc.assert(
      fc.property(statusCodeArb, urlArb, (status, url) => {
        const err = makeHttpError(status);
        const message = buildErrorMessage(err, url);
        expect(message).toContain(url);
        expect(message).toContain(String(status));
      }),
      { numRuns: 100 }
    );
  });
});
