/**
 * Tiny in-memory LRU cache with TTL. Zero deps.
 */
export class LruCache<V> {
  private readonly max: number;
  private readonly ttlMs: number;
  private readonly map = new Map<string, { value: V; expires: number }>();

  constructor(max = 200, ttlMs = 5 * 60 * 1000) {
    this.max = max;
    this.ttlMs = ttlMs;
  }

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh recency
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, ttlMs = this.ttlMs): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + ttlMs });
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
