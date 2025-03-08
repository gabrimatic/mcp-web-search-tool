

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Load environment variables from .env file
dotenvConfig({ path: resolve(rootDir, '.env') });

/**
 * Server configuration
 */
export interface ServerConfig {
    name: string;
    version: string;
}

/**
 * Search configuration
 */
export interface SearchConfig {
    apiKey: string;
    maxResults: number;
    timeout: number;
}

/**
 * Application configuration
 */
export interface AppConfig {
    server: ServerConfig;
    search: SearchConfig;
}

/**
 * Validate that required configuration is present
 *
 * @param config The configuration to validate
 * @throws Error if configuration is invalid
 */
function validateConfig(config: AppConfig): void {
    if (!config.search.apiKey) {
        throw new Error(
            'BRAVE_API_KEY environment variable is not set. ' +
            'Please create a .env file in the project root with your API key.'
        );
    }
}

/**
 * Load application configuration from environment variables
 *
 * @returns The application configuration
 * @throws Error if configuration is invalid
 */
export function loadConfig(): AppConfig {
    // Create configuration object
    const appConfig: AppConfig = {
        server: {
            name: 'mcp-web-search-tool',
            version: '1.0.0',
        },
        search: {
            apiKey: process.env.BRAVE_API_KEY || '',
            maxResults: Number(process.env.MAX_RESULTS) || 10,
            timeout: Number(process.env.REQUEST_TIMEOUT) || 10000,
        }
    };

    // Validate the configuration
    validateConfig(appConfig);

    return appConfig;
}

/**
 * Get the application configuration
 *
 * @throws Error if configuration is invalid
 */
export const appConfig = loadConfig();
