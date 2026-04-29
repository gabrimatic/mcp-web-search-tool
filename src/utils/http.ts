/**
 * HTTP helpers: timeout-aware fetch and exponential backoff with jitter.
 */

const USER_AGENT = 'mcp-web-search-tool/2.0 (+https://github.com/gabrimatic/mcp-web-search-tool)';

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Number of retry attempts on transient failures (default 2). */
  retries?: number;
  /** Hook called for each retry attempt; receives 1-based attempt number. */
  onRetry?: (attempt: number, err: unknown) => void;
  /** Redirect mode passed through to fetch (default 'follow'). */
  redirect?: 'follow' | 'manual' | 'error';
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function httpFetch(url: string, opts: FetchOptions = {}): Promise<Response> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 10_000,
    retries = 2,
    onRetry,
    redirect = 'follow'
  } = opts;

  const finalHeaders: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/html;q=0.9,*/*;q=0.5',
    ...headers
  };

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: finalHeaders,
        body,
        signal: controller.signal,
        redirect
      });
      clearTimeout(timer);

      if (!res.ok && RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        const txt = await res.text().catch(() => '');
        lastErr = new HttpError(`HTTP ${res.status}`, res.status, txt);
        await backoff(attempt, onRetry, lastErr);
        attempt++;
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message));
      // Retry network/timeouts; do not retry on the last attempt.
      if (attempt < retries && (isAbort || isNetworkError(err))) {
        await backoff(attempt, onRetry, err);
        attempt++;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('httpFetch: exhausted retries');
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /ECONN|ENETUNREACH|EAI_AGAIN|ETIMEDOUT|fetch failed|network/i.test(err.message);
}

async function backoff(
  attempt: number,
  onRetry: FetchOptions['onRetry'],
  err: unknown
): Promise<void> {
  const base = 250 * Math.pow(2, attempt); // 250ms, 500, 1000, ...
  const jitter = Math.floor(Math.random() * 100);
  const delay = base + jitter;
  onRetry?.(attempt + 1, err);
  await new Promise(r => setTimeout(r, delay));
}
