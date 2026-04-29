import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import { httpFetch } from '../utils/http.js';
import type { ExtractedPage } from '../utils/html.js';
import { extractReadable } from '../utils/html.js';
import { LruCache } from '../utils/cache.js';

export interface FetchedDocument extends ExtractedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  cached?: boolean;
  /** Opaque cursor returned when text was truncated; pass back to read more. */
  nextCursor?: string;
}

const cache = new LruCache<FetchedDocument>(
  Number(process.env.FETCH_CACHE_MAX) || 128,
  Number(process.env.FETCH_CACHE_TTL_MS) || 10 * 60 * 1000
);

const DEFAULT_TIMEOUT = Number(process.env.FETCH_TIMEOUT_MS) || 15_000;
const DEFAULT_MAX_BYTES = Number(process.env.FETCH_MAX_BYTES) || 2_000_000;
const MAX_REDIRECTS = 5;

export interface FetchUrlOptions {
  /** Soft cap on returned text characters (default 8000). */
  maxChars?: number;
  /** Hard cap on bytes downloaded (default 2 MB). */
  maxBytes?: number;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  /** Opaque cursor returned in `nextCursor`; pass back to continue reading. */
  cursor?: string;
}

export class FetchService {
  static clearCache(): void {
    cache.clear();
  }

  static async fetchUrl(rawUrl: string, opts: FetchUrlOptions = {}): Promise<FetchedDocument> {
    const initial = parseAndCheckScheme(rawUrl);

    const key = `${initial.toString()}|${opts.maxChars ?? 8000}|${opts.cursor ?? ''}`;
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

    try {
      let current = initial;
      let res: Response | null = null;

      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertPublicHost(current.hostname);

        res = await httpFetch(current.toString(), {
          timeoutMs,
          retries: hop === 0 ? 1 : 0,
          redirect: 'manual'
        });

        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location');
          if (!location) break;
          if (hop === MAX_REDIRECTS) {
            throw new McpError(
              ErrorCode.InternalError,
              `Too many redirects while fetching ${initial.toString()}`
            );
          }
          await res.body?.cancel().catch(() => undefined);
          current = new URL(location, current);
          if (current.protocol !== 'http:' && current.protocol !== 'https:') {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Refusing to follow non-http(s) redirect to ${current.protocol}`
            );
          }
          continue;
        }
        break;
      }

      if (!res) throw new McpError(ErrorCode.InternalError, 'No response received');

      const contentType = res.headers.get('content-type') ?? '';
      const buf = await readBodyCapped(res, maxBytes);
      const body = decodeBody(buf, contentType);

      const maxChars = opts.maxChars ?? 8000;
      const offset = decodeBodyCursor(opts.cursor) ?? 0;

      let title = '';
      let links: ExtractedPage['links'] = [];
      let fullText: string;

      if (contentType.includes('html') || /<html/i.test(body)) {
        // Extract once with a high cap, then slice locally — keeps pagination cheap.
        const extracted = extractReadable(body, { maxChars: 1_000_000 });
        title = extracted.title;
        links = extracted.links;
        fullText = extracted.text;
      } else {
        fullText = body;
      }

      const slice = fullText.slice(offset, offset + maxChars);
      const truncated = offset + slice.length < fullText.length;
      const text = truncated ? slice.trimEnd() + '…' : slice;
      const nextCursor = truncated ? encodeBodyCursor(offset + slice.length) : undefined;

      const doc: FetchedDocument = {
        title,
        text,
        links,
        byteLength: body.length,
        url: initial.toString(),
        finalUrl: current.toString(),
        status: res.status,
        contentType,
        ...(nextCursor ? { nextCursor } : {})
      };
      cache.set(key, doc);
      return doc;
    } catch (error) {
      if (error instanceof McpError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `URL fetch failed: ${message}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                       URL / host validation helpers                         */
/* -------------------------------------------------------------------------- */

function parseAndCheckScheme(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new McpError(ErrorCode.InvalidRequest, `Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Only http/https URLs are allowed (got ${parsed.protocol})`
    );
  }
  return parsed;
}

/**
 * Reject loopback / private / link-local destinations. Resolves the hostname
 * via DNS and inspects every returned address. Also normalises odd-but-legal
 * IPv4 forms (decimal, hex, octal, shorthand) before checking.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  const stripped = hostname.replace(/^\[|\]$/g, '');
  const lower = stripped.toLowerCase();

  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new McpError(ErrorCode.InvalidRequest, `Refusing to fetch internal host: ${hostname}`);
  }

  const literal = ipFromLiteral(stripped);
  if (literal) {
    if (isPrivateIp(literal)) {
      throw new McpError(ErrorCode.InvalidRequest, `Refusing to fetch private host: ${hostname}`);
    }
    return;
  }

  let addrs: string[];
  try {
    const records = await dns.lookup(stripped, { all: true, verbatim: true });
    addrs = records.map(r => r.address);
  } catch (err) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Cannot resolve host '${hostname}': ${(err as Error).message}`
    );
  }
  for (const addr of addrs) {
    if (isPrivateIp(addr)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Refusing to fetch private host: ${hostname} → ${addr}`
      );
    }
  }
}

function ipFromLiteral(host: string): string | null {
  if (isIP(host)) return host;
  const numeric = parseLooseIPv4(host);
  if (numeric) return numeric;
  return null;
}

function parseLooseIPv4(host: string): string | null {
  if (!/^[0-9a-fA-FxX.]+$/.test(host)) return null;
  const parts = host.split('.');
  if (parts.length === 0 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const part of parts) {
    if (part === '') return null;
    let n: number;
    if (/^0[xX][0-9a-fA-F]+$/.test(part)) n = parseInt(part, 16);
    else if (/^0[0-7]+$/.test(part)) n = parseInt(part, 8);
    else if (/^\d+$/.test(part)) n = parseInt(part, 10);
    else return null;
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }

  let a: number, b: number, c: number, d: number;
  if (nums.length === 1) {
    const v = nums[0];
    if (v > 0xffffffff) return null;
    a = (v >>> 24) & 0xff;
    b = (v >>> 16) & 0xff;
    c = (v >>> 8) & 0xff;
    d = v & 0xff;
  } else if (nums.length === 2) {
    if (nums[0] > 0xff || nums[1] > 0xffffff) return null;
    a = nums[0];
    b = (nums[1] >>> 16) & 0xff;
    c = (nums[1] >>> 8) & 0xff;
    d = nums[1] & 0xff;
  } else if (nums.length === 3) {
    if (nums[0] > 0xff || nums[1] > 0xff || nums[2] > 0xffff) return null;
    a = nums[0];
    b = nums[1];
    c = (nums[2] >>> 8) & 0xff;
    d = nums[2] & 0xff;
  } else {
    if (nums.some(n => n > 0xff)) return null;
    [a, b, c, d] = nums;
  }
  return `${a}.${b}.${c}.${d}`;
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return false;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (bytes < maxBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = maxBytes - bytes;
    if (value.byteLength > remaining) {
      chunks.push(value.subarray(0, remaining));
      break;
    }
    chunks.push(value);
    bytes += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return Buffer.concat(chunks.map(c => Buffer.from(c)));
}

function encodeBodyCursor(offset: number): string {
  return Buffer.from(`b:${offset}`, 'utf8').toString('base64url');
}

function decodeBodyCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const m = decoded.match(/^b:(\d+)$/);
    if (!m) return undefined;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function decodeBody(buf: Buffer, contentType: string): string {
  const charset = /charset=([^;\s]+)/i.exec(contentType)?.[1]?.toLowerCase();
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(buf);
    } catch {
      /* fall through to UTF-8 */
    }
  }
  return buf.toString('utf8');
}
