import fetch, { RequestInit } from 'node-fetch';
import { URL } from 'url';
import { SearchProvider, SearchResponse } from './SearchProvider.js';

/**
 * Interface representing the raw Brave API response
 */
interface BraveApiResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
    }>;
    totalResults?: number;
    timeTaken?: number;
  };
  query?: {
    original: string;
  };
}

/**
 * Brave Search Provider implementation
 * Implements the SearchProvider for the Brave Search API
 */
export class BraveSearchProvider extends SearchProvider {
  private apiEndpoint = 'https://api.search.brave.com/res/v1/web/search';

  /**
   * Get the name of the search provider
   *
   * @returns The name of the search provider
   */
  getName(): string {
    return 'Brave Search';
  }

  /**
   * Execute a search query using the Brave Search API
   *
   * @param query - The search query to execute
   * @returns Promise resolving to search results
   * @throws Error if the provider is not initialized or the search fails
   */
  async search(query: string): Promise<SearchResponse> {
    // Validate configuration using the helper method
    this.validateConfig();

    // Prepare request URL with query parameters
    const searchUrl = new URL(this.apiEndpoint);
    searchUrl.searchParams.append('q', query);

    try {
      // Set up request options
      const requestOptions: RequestInit = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.config!.apiKey
        },
        timeout: this.config!.timeout
      };

      // Execute request
      const response = await fetch(searchUrl.toString(), requestOptions);

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brave Search API error: ${response.status} - ${errorText}`);
      }

      // Parse response
      const apiResponse = await response.json() as BraveApiResponse;

      // Create response using the helper method
      const formattedResults = this.createEmptyResponse(apiResponse.query?.original || query);
      formattedResults.totalResults = apiResponse.web?.totalResults;
      formattedResults.searchTime = apiResponse.web?.timeTaken;

      // Extract and format search results
      if (apiResponse.web?.results) {
        formattedResults.results = apiResponse.web.results
          .slice(0, this.config!.maxResults)
          .map(result => ({
            title: result.title,
            url: result.url,
            description: result.description
          }));
      }

      return formattedResults;
    } catch (error: unknown) {
      // Handle timeout errors
      if (error instanceof Error && error.name === 'FetchError' && error.message.includes('timeout')) {
        throw new Error(`Search request timed out after ${this.config!.timeout / 1000} seconds`);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Web search failed: ${errorMessage}`);
    }
  }
}
