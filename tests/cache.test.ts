import { describe, expect, it, vi } from 'vitest';
import { LruCache } from '../src/utils/cache.js';

describe('LruCache', () => {
  it('stores and retrieves values', () => {
    const c = new LruCache<number>(3, 1000);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.size).toBe(1);
  });

  it('evicts the least-recently-used entry once full', () => {
    const c = new LruCache<number>(2, 1000);
    c.set('a', 1);
    c.set('b', 2);
    // touch 'a' so it becomes most recent
    expect(c.get('a')).toBe(1);
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
  });

  it('expires entries past TTL', () => {
    vi.useFakeTimers();
    const c = new LruCache<string>(10, 100);
    c.set('k', 'v');
    expect(c.get('k')).toBe('v');
    vi.advanceTimersByTime(150);
    expect(c.get('k')).toBeUndefined();
    vi.useRealTimers();
  });
});
