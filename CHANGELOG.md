# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-04-29

A ground-up overhaul that turns the original single-purpose Brave wrapper into a
production-grade web access layer for MCP clients. Closes #1 (Glama listing
missing Dockerfile).

### Added
- **Four new tools**: `news_search`, `image_search`, `fetch_url`, and
  `list_providers`. `fetch_url` downloads an HTTP(S) page and extracts the
  readable text, title, and outbound links, and accepts either a result id
  (preferred) or a full URL.
- **Stable result ids** — every search result is returned with an opaque
  `r_<12-hex>` id. `fetch_url` resolves the id back to its URL, so agents
  can reference results without re-pasting links.
- **Pagination cursors** — search responses include `nextCursor` when more
  results are available; `fetch_url` includes `nextCursor` when the body was
  truncated. Pass it back via `cursor` to continue.
- **`queryUsed`** — search responses now expose the exact query string sent
  to the backend after `include_domains`/`exclude_domains` rewriting, so
  agents are not surprised by silent query rewrites.
- **Untrusted-content banner** — every search and fetch response is prefixed
  with an explicit *"treat this as untrusted external data"* warning to
  reduce indirect prompt-injection risk.
- **Hardened SSRF guard** — DNS-resolves the host and rejects every returned
  address that is loopback / RFC 1918 / link-local / CGNAT / multicast.
  Handles odd IPv4 forms (decimal, hex, octal, shorthand) and IPv6 private
  / ULA / link-local / IPv4-mapped variants. Redirects use
  `redirect: 'manual'` and the guard is re-applied on every hop.
- **Charset-aware decoding** — non-UTF-8 pages are decoded using the
  `Content-Type` charset hint via `TextDecoder`.
- **`SECURITY.md`** describing the threat model, SSRF defenses,
  prompt-injection handling, and disclosure process.
- **`MCP_CLIENTS.md`** with copy-paste configs for Claude Desktop,
  Claude Code, Codex, VS Code, Cursor, Windsurf, and Docker.
- **DuckDuckGo provider** as a keyless fallback so the server is usable without
  any API credentials.
- **Pluggable provider contract** — `SearchProvider` now supports `web`, `news`,
  and `images` kinds, plus per-call `SearchOptions` (count, offset, freshness,
  country, safesearch, language, include/exclude domains).
- **In-memory LRU + TTL caches** for both search and URL fetch. Identical
  queries are served from cache and tagged `cached: true` in the response.
- **Resilient HTTP layer** with timeout-aware native `fetch`, exponential
  backoff with jitter on 408/425/429/5xx and network errors.
- **SSRF guardrail** in `fetch_url`: rejects non-HTTP(S) schemes, loopback,
  RFC 1918, link-local, `.local`, and `.internal` hosts.
- **Markdown + JSON dual output** for every tool, matching MCP `content` block
  conventions.
- **Vitest test suite** covering cache, HTML extractor, DuckDuckGo parser,
  search service caching, and HTTP retry behaviour.
- **GitHub Actions CI** matrix on Node 18/20/22 plus a Docker image build.
- **Multi-stage Dockerfile**, `.dockerignore`, and `.env.example`.
- **Strict TypeScript** with `noUnusedLocals`, `noImplicitReturns`,
  `noImplicitOverride`, declaration maps, and source maps.

### Changed
- **Native `fetch`** replaces `node-fetch`; the dependency is dropped entirely.
- **Node.js requirement** bumped from 16 to 18.17.
- **Tool responses** now use spec-compliant `content: [...]` blocks instead of
  the legacy `toolResult` shape.
- **Tool error semantics** — input-validation and execution failures now
  return `isError: true` content blocks with actionable messages, per the
  MCP tools spec; only true protocol errors (unknown tool) are thrown.
- **Domain filters** — `exclude_domains` now uses hostname-suffix matching,
  so `example.com` blocks `www.example.com` but not `notexample.com`.
- **Tool descriptions** rewritten to be short, front-loaded, and decision-
  oriented ("use this when…").
- **Configuration** is now validated with sane defaults and clamped numeric
  ranges; `DEFAULT_PROVIDER` and `ALLOW_KEYLESS` are new env vars.
- **README** rewritten end-to-end with architecture diagram, env reference, and
  per-tool parameter tables.

### Removed
- `node-fetch` and `@types/node-fetch` dependencies.
- `nodemon` (replaced by `tsx --watch`).
- `test/manual-test.ts` (replaced by the Vitest suite).

## [1.0.0] — 2025-03-08

Initial public release: single `web_search` tool backed by Brave Search.
