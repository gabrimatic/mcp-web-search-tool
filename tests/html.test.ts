import { describe, expect, it } from 'vitest';
import { extractReadable } from '../src/utils/html.js';

describe('extractReadable', () => {
  it('extracts the title and visible text', () => {
    const html = `
      <html><head><title>Example Domain</title></head>
      <body>
        <header><nav>nope</nav></header>
        <h1>Hello</h1>
        <p>World &amp; everything.</p>
        <script>alert(1)</script>
      </body></html>`;
    const out = extractReadable(html);
    expect(out.title).toBe('Example Domain');
    expect(out.text).toContain('Hello');
    expect(out.text).toContain('World & everything');
    expect(out.text).not.toContain('alert');
    expect(out.text).not.toContain('nope');
  });

  it('collects outbound links', () => {
    const html = `<a href="https://example.com">Example</a> <a href="javascript:void(0)">x</a>`;
    const out = extractReadable(html);
    expect(out.links).toEqual([{ text: 'Example', href: 'https://example.com' }]);
  });

  it('respects maxChars', () => {
    const long = '<p>' + 'a'.repeat(2000) + '</p>';
    const out = extractReadable(long, { maxChars: 100 });
    expect(out.text.length).toBeLessThanOrEqual(101); // accounts for ellipsis
    expect(out.text.endsWith('…')).toBe(true);
  });
});
