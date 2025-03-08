/**
 * Interface representing a single search result
 */

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults?: number;
  searchTime?: number;
}

export interface SearchProviderConfig {
  apiKey: string;
  maxResults: number;
  timeout: number;
}

export abstract class SearchProvider {
  protected config: SearchProviderConfig | null = null;

  initialize(config: SearchProviderConfig): void {
    this.config = config;
  }

  abstract getName(): string;

  abstract search(query: string): Promise<SearchResponse>;

  protected validateConfig(): void {
    if (!this.config) {
      throw new Error(`${this.getName()} provider not initialized`);
    }

    if (!this.config.apiKey) {
      throw new Error(`${this.getName()} API key not configured`);
    }
  }

  protected createEmptyResponse(query: string): SearchResponse {
    return {
      query,
      results: [],
    };
  }
}
