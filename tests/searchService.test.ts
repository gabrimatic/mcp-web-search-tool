import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SearchOptions,
  SearchProvider,
  SearchResponse,
} from '../src/providers/SearchProvider.js';
import { SearchProviderFactory } from '../src/providers/SearchProviderFactory.js';
import { SearchService } from '../src/services/SearchService.js';

class StubProvider extends SearchProvider {
  public calls = 0;
  override requiresApiKey(): boolean {
    return false;
  }
  getName(): string {
    return 'Stub';
  }
  override async search(query: string, _options: SearchOptions = {}): Promise<SearchResponse> {
    this.calls++;
    return {
      query,
      provider: this.getName(),
      kind: 'web',
      results: [{ title: 'r', url: 'https://x', description: 'd' }],
    };
  }
}

describe('SearchService', () => {
  let stub: StubProvider;

  beforeEach(() => {
    // Reset internal factory state by re-registering.
    stub = new StubProvider();
    stub.initialize({ apiKey: '', maxResults: 5, timeout: 1000 });
    SearchProviderFactory.add(stub, true);
    SearchService.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns provider results and caches identical queries', async () => {
    const a = await SearchService.search('hello');
    const b = await SearchService.search('hello');
    expect(a.results).toHaveLength(1);
    expect(b.cached).toBe(true);
    expect(stub.calls).toBe(1);
  });

  it('treats different options as separate cache keys', async () => {
    await SearchService.search('hello', { count: 5 });
    await SearchService.search('hello', { count: 10 });
    expect(stub.calls).toBe(2);
  });
});
