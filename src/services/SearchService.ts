import { SearchProviderFactory } from '../providers/SearchProviderFactory.js';
import { SearchResponse } from '../providers/SearchProvider.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class SearchService {
  /**
   * Search the web using the default provider
   */
  static async search(query: string): Promise<SearchResponse> {
    try {
      return await SearchProviderFactory.getDefault().search(query);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  /**
   * Search the web using a specific provider
   */
  static async searchWith(query: string, providerName: string): Promise<SearchResponse> {
    try {
      return await SearchProviderFactory.get(providerName).search(query);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  /**
   * Get list of available search providers
   */
  static getProviders(): string[] {
    return SearchProviderFactory.getAvailableProviders();
  }

  /**
   * Handle errors consistently
   */
  private static handleError(error: unknown): never {
    // Pass through MCP errors
    if (error instanceof McpError) {
      throw error;
    }

    // Convert other errors to MCP errors
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, `Search failed: ${message}`);
  }
}
