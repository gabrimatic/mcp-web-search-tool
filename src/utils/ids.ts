import { createHash } from 'crypto';
import { LruCache } from './cache.js';

/**
 * Tiny resolver from short, stable result IDs to canonical URLs.
 *
 * Search tools mint deterministic IDs from the result URL so the model can
 * reference results without re-pasting the full link. `fetch_url` accepts
 * either a URL or an ID, looks up the URL here, and proceeds normally.
 */
const idStore = new LruCache<string>(
  Number(process.env.RESULT_ID_CACHE_MAX) || 2_000,
  Number(process.env.RESULT_ID_TTL_MS) || 60 * 60 * 1000 // 1 hour
);

const ID_PREFIX = 'r_';

/** Deterministic 12-char id derived from the URL. */
export function mintResultId(url: string): string {
  const id = ID_PREFIX + createHash('sha1').update(url).digest('hex').slice(0, 12);
  idStore.set(id, url);
  return id;
}

/** True when `value` looks like an ID minted by this module. */
export function looksLikeResultId(value: string): boolean {
  return /^r_[0-9a-f]{12}$/.test(value);
}

/** Resolve an ID back to its URL, or undefined if it expired or is unknown. */
export function resolveResultId(id: string): string | undefined {
  return idStore.get(id);
}

/** Test helper. */
export function clearIdStore(): void {
  idStore.clear();
}
