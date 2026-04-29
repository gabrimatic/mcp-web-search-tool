import { httpFetch, HttpError } from '../utils/http.js';
import { mintResultId } from '../utils/ids.js';
import { matchesAnyDomain } from './BraveSearchProvider.js';
import {
  SearchKind,
  SearchOptions,
  SearchProvider,
  SearchResponse,
  SearchResult,
} from './SearchProvider.js';

/**
 * Keyless fallback provider that scrapes the lightweight HTML endpoint.
 * Useful when no Brave API key is configured. Web-only.
 */
export class DuckDuckGoProvider extends SearchProvider {
  getName(): string {
    return 'DuckDuckGo';
  }

  override requiresApiKey(): boolean {
    return false;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    if (!this.config) throw new Error('DuckDuckGo provider not initialized');

    const kind: SearchKind = options.kind ?? 'web';
    if (kind !== 'web') {
      throw new Error(`DuckDuckGo provider does not support kind="${kind}"`);
    }

    const q = this.buildQuery(query, options);
    const u = new URL('https://html.duckduckgo.com/html/');
    u.searchParams.set('q', q);
    if (options.country) u.searchParams.set('kl', options.country);

    const res = await httpFetch(u.toString(), {
      timeoutMs: this.config.timeout,
      headers: {
        Accept: 'text/html',
        'Accept-Language': options.searchLang ?? 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(`DuckDuckGo error: ${res.status}`, res.status, body);
    }

    const html = await res.text();
    const limit = Math.min(options.count ?? this.config.maxResults, 25);

    const out = this.emptyResponse(query, 'web');
    out.queryUsed = q;
    out.results = parseDdgResults(html, limit);

    if (options.excludeDomains?.length) {
      out.results = out.results.filter((r) => !matchesAnyDomain(r.url, options.excludeDomains!));
    }
    return out;
  }

  private buildQuery(query: string, opts: SearchOptions): string {
    const parts = [query];
    if (opts.includeDomains?.length) {
      parts.push('(' + opts.includeDomains.map((d) => `site:${d}`).join(' OR ') + ')');
    }
    if (opts.excludeDomains?.length) {
      parts.push(...opts.excludeDomains.map((d) => `-site:${d}`));
    }
    return parts.join(' ');
  }
}

export function parseDdgResults(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  const blockRe =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(blockRe)) {
    const rawUrl = decodeEntities(m[1]);
    const url = unwrapDdg(rawUrl);
    const title = decodeEntities(stripTags(m[2])).trim();
    const description = decodeEntities(stripTags(m[3])).trim();
    if (!url || !title) continue;
    results.push({ id: mintResultId(url), title, url, description });
    if (results.length >= limit) break;
  }
  return results;
}

function unwrapDdg(href: string): string {
  // DDG often wraps real URLs as /l/?uddg=<encoded>
  try {
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
    if (href.startsWith('//')) return 'https:' + href;
    return href;
  } catch {
    return href;
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/gi, '/');
}
