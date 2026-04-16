import { tavily } from '@tavily/core';
import { SearchProvider, SearchResponse } from './SearchProvider.js';

/**
 * Tavily Search Provider implementation
 * Implements the SearchProvider for the Tavily Search API
 */
export class TavilySearchProvider extends SearchProvider {
  private client: ReturnType<typeof tavily> | null = null;

  /**
   * Get the name of the search provider
   */
  getName(): string {
    return 'Tavily';
  }

  /**
   * Execute a search query using the Tavily Search API
   *
   * @param query - The search query to execute
   * @returns Promise resolving to search results
   * @throws Error if the provider is not initialized or the search fails
   */
  async search(query: string): Promise<SearchResponse> {
    this.validateConfig();

    if (!this.client) {
      this.client = tavily({ apiKey: this.config!.apiKey });
    }

    try {
      const tavilyResponse = await this.client.search(query, {
        maxResults: this.config!.maxResults,
      });

      const formattedResults = this.createEmptyResponse(query);

      if (tavilyResponse.results) {
        formattedResults.results = tavilyResponse.results.map((result: { title: string; url: string; content: string }) => ({
          title: result.title,
          url: result.url,
          description: result.content,
        }));
      }

      return formattedResults;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Tavily search failed: ${errorMessage}`);
    }
  }
}
