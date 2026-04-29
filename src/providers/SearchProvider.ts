/**
 * Pluggable web-search provider contract.
 */

export type SearchKind = 'web' | 'news' | 'images';

export type Freshness = 'pd' | 'pw' | 'pm' | 'py' | string;

export interface SearchOptions {
  /** Number of results requested (provider may clamp). */
  count?: number;
  /** Pagination offset (where supported). */
  offset?: number;
  /** Opaque pagination cursor returned from a previous response. */
  cursor?: string;
  /** Freshness filter — Brave: pd/pw/pm/py, or YYYY-MM-DDtoYYYY-MM-DD. */
  freshness?: Freshness;
  /** ISO country code (e.g. "us", "de"). */
  country?: string;
  /** Search UI language code (e.g. "en"). */
  searchLang?: string;
  /** Safesearch level. */
  safesearch?: 'off' | 'moderate' | 'strict';
  /** Optional allowlist of domains. */
  includeDomains?: string[];
  /** Optional blocklist of domains. */
  excludeDomains?: string[];
  /** Result type. */
  kind?: SearchKind;
}

export interface SearchResult {
  /** Stable, opaque id. Round-trips back to `url` via `fetch_url`. */
  id: string;
  title: string;
  url: string;
  description: string;
  /** ISO date string when available (news/images). */
  publishedAt?: string;
  /** Source/site name when available. */
  source?: string;
  /** Thumbnail URL when available (images/news). */
  thumbnail?: string;
}

export interface SearchResponse {
  query: string;
  /** The exact query string that was sent to the backend (after filters). */
  queryUsed?: string;
  provider: string;
  kind: SearchKind;
  results: SearchResult[];
  totalResults?: number;
  searchTime?: number;
  /** Opaque pagination cursor; pass back via `cursor` to fetch the next page. */
  nextCursor?: string;
  /** True if this response came from the cache. */
  cached?: boolean;
}

export interface SearchProviderConfig {
  apiKey: string;
  maxResults: number;
  timeout: number;
}

export abstract class SearchProvider {
  protected config: SearchProviderConfig | null = null;

  initialize(config: SearchProviderConfig): void {
    this.config = config;
  }

  abstract getName(): string;

  /** Whether this provider supports a given search kind. */
  supports(kind: SearchKind): boolean {
    return kind === 'web';
  }

  /** Whether this provider needs an API key to function. */
  requiresApiKey(): boolean {
    return true;
  }

  abstract search(query: string, options?: SearchOptions): Promise<SearchResponse>;

  protected validateConfig(): void {
    if (!this.config) {
      throw new Error(`${this.getName()} provider not initialized`);
    }
    if (this.requiresApiKey() && !this.config.apiKey) {
      throw new Error(`${this.getName()} API key not configured`);
    }
  }

  protected emptyResponse(query: string, kind: SearchKind = 'web'): SearchResponse {
    return { query, provider: this.getName(), kind, results: [] };
  }
}
