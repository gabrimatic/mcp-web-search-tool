import { httpFetch, HttpError } from '../utils/http.js';
import { mintResultId } from '../utils/ids.js';
import type { SearchKind, SearchOptions, SearchResponse, SearchResult } from './SearchProvider.js';
import { SearchProvider } from './SearchProvider.js';

interface BraveWebApiResponse {
  web?: { results?: BraveWebItem[]; totalResults?: number; timeTaken?: number };
  query?: { original?: string };
}

interface BraveWebItem {
  title: string;
  url: string;
  description: string;
  age?: string;
  page_age?: string;
  meta_url?: { hostname?: string };
  thumbnail?: { src?: string };
}

interface BraveNewsApiResponse {
  results?: BraveNewsItem[];
  query?: { original?: string };
}

interface BraveNewsItem {
  title: string;
  url: string;
  description?: string;
  age?: string;
  page_age?: string;
  source?: string;
  meta_url?: { hostname?: string };
  thumbnail?: { src?: string };
}

interface BraveImageApiResponse {
  results?: BraveImageItem[];
  query?: { original?: string };
}

interface BraveImageItem {
  title: string;
  url: string;
  source?: string;
  thumbnail?: { src?: string };
  properties?: { url?: string };
}

const ENDPOINTS: Record<SearchKind, string> = {
  web: 'https://api.search.brave.com/res/v1/web/search',
  news: 'https://api.search.brave.com/res/v1/news/search',
  images: 'https://api.search.brave.com/res/v1/images/search'
};

export class BraveSearchProvider extends SearchProvider {
  getName(): string {
    return 'Brave Search';
  }

  override supports(kind: SearchKind): boolean {
    return kind === 'web' || kind === 'news' || kind === 'images';
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    this.validateConfig();

    const kind: SearchKind = options.kind ?? 'web';
    const endpoint = ENDPOINTS[kind];
    const u = new URL(endpoint);
    const queryUsed = this.applyDomainFilters(query, options);
    u.searchParams.set('q', queryUsed);

    const count = Math.min(options.count ?? this.config!.maxResults, 20);
    u.searchParams.set('count', String(count));
    const offset = decodeCursor(options.cursor) ?? options.offset;
    if (offset != null && kind === 'web') {
      u.searchParams.set('offset', String(offset));
    }
    if (options.freshness) u.searchParams.set('freshness', options.freshness);
    if (options.country) u.searchParams.set('country', options.country);
    if (options.searchLang) u.searchParams.set('search_lang', options.searchLang);
    if (options.safesearch) u.searchParams.set('safesearch', options.safesearch);

    const res = await httpFetch(u.toString(), {
      timeoutMs: this.config!.timeout,
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': this.config!.apiKey
      }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(`Brave Search API error: ${res.status}`, res.status, body);
    }

    const json = (await res.json()) as
      | BraveWebApiResponse
      | BraveNewsApiResponse
      | BraveImageApiResponse;

    const out = this.emptyResponse(query, kind);
    out.query = (json as BraveWebApiResponse).query?.original ?? query;
    out.queryUsed = queryUsed;

    if (kind === 'web') {
      const w = (json as BraveWebApiResponse).web;
      out.totalResults = w?.totalResults;
      out.searchTime = w?.timeTaken;
      out.results = (w?.results ?? []).slice(0, count).map(toWebResult);
      if (out.results.length === count) {
        out.nextCursor = encodeCursor((offset ?? 0) + count);
      }
    } else if (kind === 'news') {
      out.results = ((json as BraveNewsApiResponse).results ?? [])
        .slice(0, count)
        .map(toNewsResult);
    } else {
      out.results = ((json as BraveImageApiResponse).results ?? [])
        .slice(0, count)
        .map(toImageResult);
    }

    if (options.excludeDomains?.length) {
      out.results = out.results.filter(r => !matchesAnyDomain(r.url, options.excludeDomains!));
    }

    return out;
  }

  private applyDomainFilters(query: string, opts: SearchOptions): string {
    const parts = [query];
    if (opts.includeDomains?.length) {
      parts.push('(' + opts.includeDomains.map(d => `site:${d}`).join(' OR ') + ')');
    }
    // Brave does not reliably honor `-site:` operator; we also post-filter excludeDomains.
    if (opts.excludeDomains?.length) {
      parts.push(...opts.excludeDomains.map(d => `-site:${d}`));
    }
    return parts.join(' ');
  }
}

/** Hostname-suffix match so `example.com` blocks `www.example.com` but not `notexample.com`. */
export function matchesAnyDomain(rawUrl: string, domains: string[]): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  for (const d of domains) {
    const needle = d.toLowerCase().replace(/^\./, '');
    if (!needle) continue;
    if (host === needle || host.endsWith('.' + needle)) return true;
  }
  return false;
}

function toWebResult(r: BraveWebItem): SearchResult {
  const url = r.url;
  return {
    id: mintResultId(url),
    title: r.title,
    url,
    description: r.description,
    publishedAt: r.page_age ?? r.age,
    source: r.meta_url?.hostname,
    thumbnail: r.thumbnail?.src
  };
}

function toNewsResult(r: BraveNewsItem): SearchResult {
  const url = r.url;
  return {
    id: mintResultId(url),
    title: r.title,
    url,
    description: r.description ?? '',
    publishedAt: r.page_age ?? r.age,
    source: r.source ?? r.meta_url?.hostname,
    thumbnail: r.thumbnail?.src
  };
}

function toImageResult(r: BraveImageItem): SearchResult {
  const url = r.properties?.url ?? r.url;
  return {
    id: mintResultId(url),
    title: r.title,
    url,
    description: r.source ?? '',
    thumbnail: r.thumbnail?.src,
    source: r.source
  };
}

/* ------------------------------ Cursor codec ------------------------------ */

/** Cursor is just an opaque base64url-encoded offset. Keeps the API stable
 *  even if we change the underlying pagination scheme later. */
function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const m = decoded.match(/^o:(\d+)$/);
    if (!m) return undefined;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}
