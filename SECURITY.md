# Security

This document describes how MCP Web Search Tool handles untrusted input,
network access, secrets, and supply-chain risk, and how to report issues you
find.

## Threat model

The server has two main attack surfaces:

1. **Tool inputs** — anything the model passes through `tools/call`.
2. **Tool outputs** — fetched HTML, search snippets, page bodies, and link
   text returned to the model. *Every* byte returned from the open web is
   treated as untrusted data.

The server has **no write capabilities** — it only reads from the public web
and returns text. There is no shell access, no filesystem access beyond the
package itself, and no database.

## Untrusted-content handling

- Search results and `fetch_url` responses are prefixed with an
  *"untrusted external content"* banner so downstream agents do not confuse
  them with operator instructions. See `UNTRUSTED_BANNER` in `src/index.ts`.
- HTML is sanitised in `src/utils/html.ts`: `<script>`, `<style>`,
  `<iframe>`, `<noscript>`, `<svg>`, `<form>`, `<nav>`, `<header>`,
  `<footer>`, and `<aside>` blocks are stripped before text extraction.
- Numeric and named HTML entities are decoded; raw HTML never reaches the
  model.
- Indirect prompt injection is mitigated by treating fetched content as data,
  but any agent integrating this server **must not** auto-execute commands or
  follow tool-calling instructions inside fetched text.

## Server-Side Request Forgery (SSRF)

`fetch_url` enforces several layers of defense before issuing a request:

- **Scheme allow-list.** Only `http://` and `https://` URLs are accepted.
- **Host normalisation.** Odd-but-legal IPv4 forms (decimal, hex, octal,
  shorthand) are normalised before checking — `0x7f000001`, `2130706433`,
  and `127.1` are all detected as `127.0.0.0/8`.
- **DNS resolution.** Hostnames are resolved via `dns.lookup` with `all:
  true`, and *every* returned address must be public. A DNS rebinding answer
  pointing at `127.0.0.1` is rejected.
- **Private-range filter.** Loopback, RFC 1918 (10/8, 172.16/12,
  192.168/16), link-local (169.254/16), CGNAT (100.64/10), 0.0.0.0/8,
  multicast (224/4 and up), IPv6 loopback (`::1`), link-local (`fe80::/10`),
  ULA (`fc00::/7`), and IPv4-mapped IPv6 forms of any of the above are all
  refused.
- **Special hostnames.** `localhost`, `*.local`, `*.internal` are refused
  before DNS is consulted.
- **Manual redirects.** Redirects are followed up to a 5-hop cap, and the
  full SSRF guard is re-applied at every hop. A `200 OK` page that 302s to
  `127.0.0.1` cannot bypass the check.
- **Byte budget.** Bodies are capped at `FETCH_MAX_BYTES` (default 2 MB);
  the cap is exact, not chunk-aligned.
- **Timeout.** Each request has an `AbortController` timeout
  (`FETCH_TIMEOUT_MS`, default 15 s).

Cloud metadata endpoints (`169.254.169.254`) are blocked by the link-local
rule.

## Network discipline

- `node-fetch` is **not** used; only the platform `fetch` is.
- A descriptive `User-Agent` is sent on every request:
  `mcp-web-search-tool/<version>`.
- Retries use exponential backoff with jitter and only fire on transient
  statuses (408, 425, 429, 5xx) and network errors.

## Secrets

- The Brave API key is read from `BRAVE_API_KEY` and never logged.
- No other tokens or credentials are accepted or stored.
- Tool arguments and results are not persisted anywhere; the only state is
  in-memory caches that are cleared on process exit.

## Logging

- All log lines go to **stderr**. `stdout` is reserved for JSON-RPC, per the
  MCP stdio spec.
- The default logger prints tool name, query, result count, and provider —
  never API keys, full request bodies, or response bodies.

## Supply chain

- The runtime dependency surface is intentionally minimal:
  `@modelcontextprotocol/sdk` and `dotenv`. Everything else (HTML extraction,
  retry, cache, ID minting, SSRF guard) is in-tree.
- The Docker image runs as the non-root `node` user out of `node:20-alpine`.
- A `package-lock.json` is committed; CI uses `npm ci`.

## Reporting a vulnerability

Please email **h.yusefpour@gmail.com** with the subject
`[SECURITY] mcp-web-search-tool` and a minimal reproduction. Do **not** open
a public issue for security problems.

We aim to acknowledge reports within 72 hours and to ship a fix or
mitigation within 14 days for confirmed issues.
