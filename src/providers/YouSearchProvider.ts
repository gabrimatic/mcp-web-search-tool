/**
 * You.com web search provider.
 *
 * Uses the You.com Search API (REST) with optional API key authentication.
 * When YDC_API_KEY is set it uses the authenticated tier (higher rate limits);
 * otherwise it falls back to the keyless free profile.
 *
 * See https://api.you.com/v1/agents/search
 */

import { httpFetch, HttpError } from '../utils/http.js';
import { mintResultId } from '../utils/ids.js';
import { matchesAnyDomain } from './BraveSearchProvider.js';
import type { SearchKind, SearchOptions, SearchResponse, SearchResult } from './SearchProvider.js';
import { SearchProvider } from './SearchProvider.js';

interface YouSearchHit {
  title?: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  age?: string;
  publishedAt?: string;
  source?: string;
  thumbnail?: string;
}

interface YouSearchApiResponse {
  results?: YouSearchHit[];
  hits?: YouSearchHit[];
  totalResults?: number;
  searchTime?: number;
}

export class YouSearchProvider extends SearchProvider {
  getName(): string {
    return 'You.com Search';
  }

  override requiresApiKey(): boolean {
    // Works without a key (keyless free profile via ?profile=free)
    return false;
  }

  override supports(kind: SearchKind): boolean {
    return kind === 'web';
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    if (!this.config) throw new Error('You.com Search provider not initialized');

    const kind: SearchKind = options.kind ?? 'web';
    if (kind !== 'web') {
      throw new Error(`You.com Search provider does not support kind="${kind}"`);
    }

    const q = this.buildQuery(query, options);
    const u = new URL('https://api.you.com/v1/agents/search');
    u.searchParams.set('query', q);

    const count = Math.min(options.count ?? this.config.maxResults, 20);
    u.searchParams.set('num_results', String(count));

    // Keyless free profile when no API key is configured
    if (!this.config.apiKey) {
      u.searchParams.set('profile', 'free');
    }

    if (options.country) u.searchParams.set('country', options.country);
    if (options.safesearch) u.searchParams.set('safesearch', options.safesearch);

    const headers: Record<string, string> = {
      Accept: 'application/json'
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const res = await httpFetch(u.toString(), {
      timeoutMs: this.config.timeout,
      headers
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(`You.com Search API error: ${res.status}`, res.status, body);
    }

    const json = (await res.json()) as YouSearchApiResponse;
    const hits = json.results ?? json.hits ?? [];

    const out = this.emptyResponse(query, 'web');
    out.queryUsed = q;
    out.totalResults = json.totalResults;
    out.results = hits.slice(0, count).map((hit) => toSearchResult(hit));

    if (options.excludeDomains?.length) {
      out.results = out.results.filter(
        (r) => !matchesAnyDomain(r.url, options.excludeDomains!)
      );
    }

    return out;
  }

  private buildQuery(query: string, opts: SearchOptions): string {
    const parts = [query];
    if (opts.freshness) {
      let recency = opts.freshness;
      // Translate MCP freshness codes to You.com date range
      if (recency === 'pd') recency = '1 day';
      else if (recency === 'pw') recency = '1 week';
      else if (recency === 'pm') recency = '1 month';
      else if (recency === 'py') recency = '1 year';
      parts.push(`after:${recency}`);
    }
    if (opts.includeDomains?.length) {
      parts.push('(' + opts.includeDomains.map((d) => `site:${d}`).join(' OR ') + ')');
    }
    if (opts.excludeDomains?.length) {
      parts.push(...opts.excludeDomains.map((d) => `-site:${d}`));
    }
    return parts.join(' ');
  }
}

function toSearchResult(hit: YouSearchHit): SearchResult {
  const url = hit.url ?? hit.link ?? '';
  return {
    id: mintResultId(url),
    title: hit.title ?? '',
    url,
    description: hit.snippet ?? hit.description ?? '',
    publishedAt: hit.publishedAt ?? hit.age,
    source: hit.source,
    thumbnail: hit.thumbnail
  };
}