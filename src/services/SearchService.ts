import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SearchProviderFactory } from '../providers/SearchProviderFactory.js';
import type { SearchOptions, SearchResponse } from '../providers/SearchProvider.js';
import { LruCache } from '../utils/cache.js';

const cache = new LruCache<SearchResponse>(
  Number(process.env.CACHE_MAX_ENTRIES) || 256,
  Number(process.env.CACHE_TTL_MS) || 5 * 60 * 1000
);

function cacheKey(provider: string, query: string, opts: SearchOptions): string {
  // Build a deterministic key independent of property insertion order.
  const normalized: Record<string, unknown> = { kind: 'web', ...opts };
  const sortedEntries = Object.entries(normalized)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return [provider.toLowerCase(), query.trim().toLowerCase(), JSON.stringify(sortedEntries)].join(
    '|'
  );
}

export class SearchService {
  static clearCache(): void {
    cache.clear();
  }

  static async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    return this.searchWith(query, undefined, options);
  }

  static async searchWith(
    query: string,
    providerName: string | undefined,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    try {
      const provider = providerName
        ? SearchProviderFactory.get(providerName)
        : SearchProviderFactory.getDefault();

      const key = cacheKey(provider.getName(), query, options);
      const hit = cache.get(key);
      if (hit) return { ...hit, cached: true };

      const result = await provider.search(query, options);
      cache.set(key, result);
      return result;
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  static getProviders(): string[] {
    return SearchProviderFactory.getAvailableProviders();
  }

  private static handleError(error: unknown): never {
    if (error instanceof McpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, `Search failed: ${message}`);
  }
}
