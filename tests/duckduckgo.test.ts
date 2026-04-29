import { describe, expect, it } from 'vitest';
import { parseDdgResults } from '../src/providers/DuckDuckGoProvider.js';

const SAMPLE = `
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">First &amp; Best</a>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">A great snippet about <b>things</b>.</a>
</div>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fb">Second</a>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fb">Another snippet.</a>
</div>
`;

describe('parseDdgResults', () => {
  it('parses titles, urls, and snippets, decoding wrapped uddg', () => {
    const out = parseDdgResults(SAMPLE, 10);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      title: 'First & Best',
      url: 'https://example.com/a',
      description: 'A great snippet about things.'
    });
    expect(out[0]?.id).toMatch(/^r_[0-9a-f]{12}$/);
    expect(out[1]?.url).toBe('https://example.org/b');
  });

  it('respects the limit', () => {
    expect(parseDdgResults(SAMPLE, 1)).toHaveLength(1);
  });
});
