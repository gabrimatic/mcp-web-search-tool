import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpFetch } from '../src/utils/http.js';

describe('httpFetch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retries retryable HTTP statuses then succeeds', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n++;
      if (n < 2) {
        return new Response('busy', { status: 503 });
      }
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('https://example.com', { retries: 2, timeoutMs: 1000 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('https://example.com', { retries: 3, timeoutMs: 1000 });
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
