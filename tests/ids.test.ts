import { describe, expect, it } from 'vitest';
import { looksLikeResultId, mintResultId, resolveResultId } from '../src/utils/ids.js';

describe('result id resolver', () => {
  it('mints stable, recognisable ids and resolves them', () => {
    const url = 'https://example.com/foo?bar=1';
    const id = mintResultId(url);
    expect(id).toMatch(/^r_[0-9a-f]{12}$/);
    expect(looksLikeResultId(id)).toBe(true);
    expect(resolveResultId(id)).toBe(url);
  });

  it('produces the same id for the same url', () => {
    const url = 'https://example.com/x';
    expect(mintResultId(url)).toBe(mintResultId(url));
  });

  it('rejects non-id strings', () => {
    expect(looksLikeResultId('https://example.com')).toBe(false);
    expect(looksLikeResultId('r_short')).toBe(false);
    expect(looksLikeResultId('R_AABBCCDDEEFF')).toBe(false); // case-sensitive
  });

  it('returns undefined for unknown ids', () => {
    expect(resolveResultId('r_000000000000')).toBeUndefined();
  });
});
