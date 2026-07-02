import { config as dotenvConfig } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

dotenvConfig({ path: resolve(rootDir, '.env'), quiet: true });

export interface ServerConfig {
  name: string;
  version: string;
}

export interface SearchConfig {
  apiKey: string;
  maxResults: number;
  timeout: number;
  defaultProvider?: string;
}

export interface AppConfig {
  server: ServerConfig;
  search: SearchConfig;
  /** When true, the server boots without a Brave API key and uses keyless providers. */
  allowKeyless: boolean;
}

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function loadConfig(): AppConfig {
  const apiKey = process.env.BRAVE_API_KEY ?? '';
  const allowKeyless = (process.env.ALLOW_KEYLESS ?? 'true').toLowerCase() !== 'false';

  if (!apiKey && !allowKeyless) {
    throw new Error(
      'BRAVE_API_KEY is not set and ALLOW_KEYLESS is disabled. ' +
        'Set BRAVE_API_KEY in .env or set ALLOW_KEYLESS=true to use keyless providers (DuckDuckGo).'
    );
  }

  return {
    server: {
      name: 'mcp-web-search-tool',
      version: readPackageVersion()
    },
    search: {
      apiKey,
      maxResults: clampInt(process.env.MAX_RESULTS, 10, 1, 50),
      timeout: clampInt(process.env.REQUEST_TIMEOUT, 10_000, 1_000, 60_000),
      defaultProvider: process.env.DEFAULT_PROVIDER
    },
    allowKeyless
  };
}

export const appConfig = loadConfig();
