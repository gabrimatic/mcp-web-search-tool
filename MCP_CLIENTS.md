# MCP client setup

Copy-paste configurations for the most common MCP clients. The server speaks
**stdio** only — there is no HTTP transport (yet).

> Replace `/abs/path/to/mcp-web-search-tool` with the directory you cloned
> the repo into, and `your_brave_api_key_here` with a real key. The
> `BRAVE_API_KEY` env var is **optional**: when it is omitted the server
> falls back to the keyless DuckDuckGo provider.

---

## Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%AppData%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/abs/path/to/mcp-web-search-tool/build/index.js"],
      "env": {
        "BRAVE_API_KEY": "your_brave_api_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. The tools surface as `web_search`, `news_search`,
`image_search`, `fetch_url`, and `list_providers`.

## Claude Code

```bash
claude mcp add web-search \
  -- node /abs/path/to/mcp-web-search-tool/build/index.js
```

To set the API key:

```bash
claude mcp add web-search \
  --env BRAVE_API_KEY=your_brave_api_key_here \
  -- node /abs/path/to/mcp-web-search-tool/build/index.js
```

Verify with `/mcp` inside Claude Code.

## Codex (OpenAI)

`~/.codex/config.toml`:

```toml
[mcp.servers.web_search]
command = "node"
args = ["/abs/path/to/mcp-web-search-tool/build/index.js"]
env = { BRAVE_API_KEY = "your_brave_api_key_here" }
```

## VS Code (GitHub Copilot agent mode)

`.vscode/mcp.json` in your workspace, or the user-scope equivalent:

```json
{
  "servers": {
    "web-search": {
      "type": "stdio",
      "command": "node",
      "args": ["/abs/path/to/mcp-web-search-tool/build/index.js"],
      "env": { "BRAVE_API_KEY": "your_brave_api_key_here" }
    }
  }
}
```

## Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/abs/path/to/mcp-web-search-tool/build/index.js"],
      "env": { "BRAVE_API_KEY": "your_brave_api_key_here" }
    }
  }
}
```

## Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/abs/path/to/mcp-web-search-tool/build/index.js"],
      "env": { "BRAVE_API_KEY": "your_brave_api_key_here" }
    }
  }
}
```

## Docker

For clients that prefer a container, build once and reference the image:

```bash
docker build -t mcp-web-search .
```

```json
{
  "mcpServers": {
    "web-search": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "BRAVE_API_KEY", "mcp-web-search"]
    }
  }
}
```

(Pass `BRAVE_API_KEY` from your shell environment so it isn't written into
the config file.)

## MCP Inspector

For local development:

```bash
npm run inspector
```

This launches `@modelcontextprotocol/inspector` against the built server so
you can browse `tools/list`, call tools, and view structured responses.

## Sanity checks

| Step | Expected |
|---|---|
| `tools/list` | Returns 5 tools: `web_search`, `news_search`, `image_search`, `fetch_url`, `list_providers`. |
| `list_providers` (no key) | `duckduckgo` listed and marked default. |
| `list_providers` (with `BRAVE_API_KEY`) | `brave search` *and* `duckduckgo`, with Brave default. |
| `news_search` (no key) | `isError: true` with a message pointing at `BRAVE_API_KEY`. |
| `fetch_url` with `id_or_url: "http://127.0.0.1"` | `isError: true` — refused by the SSRF guard. |
