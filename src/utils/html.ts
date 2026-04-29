/**
 * Lightweight HTML → readable text/markdown extraction. Zero deps.
 *
 * This is intentionally simple: strips scripts/styles/nav/footer,
 * keeps headings/links/list structure, collapses whitespace.
 */

const BLOCK_REPLACE: Array<[RegExp, string]> = [
  [/<\s*br\s*\/?\s*>/gi, '\n'],
  [/<\s*\/p\s*>/gi, '\n\n'],
  [/<\s*\/(div|section|article|li|tr|h[1-6])\s*>/gi, '\n'],
  [/<\s*li[^>]*>/gi, '- '],
];

const STRIP_BLOCKS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'nav',
  'footer',
  'header',
  'aside',
  'form',
];

export interface ExtractedPage {
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  byteLength: number;
}

export function extractReadable(html: string, opts: { maxChars?: number } = {}): ExtractedPage {
  const maxChars = opts.maxChars ?? 8_000;

  let work = html;
  for (const tag of STRIP_BLOCKS) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    work = work.replace(re, ' ');
  }

  const titleMatch = work.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() : '';

  const links: ExtractedPage['links'] = [];
  const linkMatches = work.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches) {
    const href = m[1];
    const text = decodeEntities(stripTags(m[2])).trim();
    if (text && href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      links.push({ text, href });
    }
    if (links.length >= 50) break;
  }

  for (const [re, repl] of BLOCK_REPLACE) work = work.replace(re, repl);
  let text = stripTags(work);
  text = decodeEntities(text);
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (text.length > maxChars) text = text.slice(0, maxChars).trimEnd() + '…';

  return { title, text, links, byteLength: html.length };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)));
}
