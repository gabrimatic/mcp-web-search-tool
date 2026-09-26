import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { YouSearchProvider } from '../src/providers/YouSearchProvider.js';

function makeProvider(apiKey = ''): YouSearchProvider {
  const p = new YouSearchProvider();
  p.initialize({ apiKey, youcomApiKey: apiKey, maxResults: 5, timeout: 5000 });
  return p;
}

describe('YouSearchProvider', () => {
  let provider: YouSearchProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports its name', () => {
    expect(provider.getName()).toBe('You.com Search');
  });

  it('does not require an API key', () => {
    expect(provider.requiresApiKey()).toBe(false);
  });

  it('supports web search only', () => {
    expect(provider.supports('web')).toBe(true);
    expect(provider.supports('news')).toBe(false);
    expect(provider.supports('images')).toBe(false);
  });

  it('throws on non-web search kinds', async () => {
    await expect(
      provider.search('hello', { kind: 'news' }),
    ).rejects.toThrow('does not support kind="news"');
  });

  it('builds a search URL with query and default params', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [] })),
    );

    await provider.search('hello world');

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('query=hello+world');
    expect(url).toContain('num_results=5');
    expect(url).toContain('profile=free');
  });

  it('sends auth header when API key is set', async () => {
    const keyed = makeProvider('sk-my-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [] })),
    );

    await keyed.search('test');

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const opts = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-my-key');
    expect(url).not.toContain('profile=free');
  });

  it('parses search results from the API response', async () => {
    const response = {
      results: [
        { title: 'Result One', url: 'https://example.com/1', snippet: 'First result' },
        { title: 'Result Two', url: 'https://example.com/2', snippet: 'Second result', age: '2026-09-20' },
      ],
      totalResults: 2,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response)),
    );

    const result = await provider.search('test query');

    expect(result.provider).toBe('You.com Search');
    expect(result.kind).toBe('web');
    expect(result.totalResults).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      title: 'Result One',
      url: 'https://example.com/1',
      description: 'First result',
    });
    expect(result.results[0]?.id).toMatch(/^r_[0-9a-f]{12}$/);
    expect(result.results[1]?.publishedAt).toBe('2026-09-20');
  });

  it('handles empty results gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({})),
    );

    const result = await provider.search('empty query');
    expect(result.results).toHaveLength(0);
  });

  it('respects excludeDomains filter', async () => {
    const response = {
      results: [
        { title: 'Keep', url: 'https://keep.example.com/page', snippet: 'good' },
        { title: 'Filter', url: 'https://blocked.example.net/page', snippet: 'bad' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response)),
    );

    const result = await provider.search('filtered', {
      excludeDomains: ['blocked.example.net'],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.title).toBe('Keep');
  });

  it('passes count parameter to the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [] })),
    );

    await provider.search('count test', { count: 3 });

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('num_results=3');
  });

  it('sends safesearch and country params when provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [] })),
    );

    await provider.search('location', { country: 'de', safesearch: 'moderate' });

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('country=de');
    expect(url).toContain('safesearch=moderate');
  });
});