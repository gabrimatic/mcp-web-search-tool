import { BraveSearchProvider } from './BraveSearchProvider.js';
import { SearchProvider, SearchProviderConfig } from './SearchProvider.js';

export class SearchProviderFactory {
  private static providers = new Map<string, SearchProvider>();
  private static defaultProviderName: string | null = null;

  /**
   * Add a provider to the registry
   */
  static add(provider: SearchProvider, makeDefault = false): void {
    const name = provider.getName().toLowerCase();
    this.providers.set(name, provider);

    if (makeDefault || !this.defaultProviderName) {
      this.defaultProviderName = name;
    }
  }

  /**
   * Get a provider by name
   */
  static get(name: string): SearchProvider {
    const provider = this.providers.get(name.toLowerCase());

    if (!provider) {
      throw new Error(`Provider not found: ${name}`);
    }

    return provider;
  }

  /**
   * Get the default provider
   */
  static getDefault(): SearchProvider {
    if (!this.defaultProviderName || this.providers.size === 0) {
      throw new Error('No search providers available');
    }

    return this.get(this.defaultProviderName);
  }

  /**
   * Set which provider is the default
   */
  static setDefault(name: string): void {
    // Make sure the provider exists before setting it as default
    this.get(name);
    this.defaultProviderName = name.toLowerCase();
  }

  /**
   * Get names of all available providers
   */
  static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Setup with Brave Search (convenience method)
   */
  static setupBraveSearch(config: SearchProviderConfig): void {
    const brave = new BraveSearchProvider();
    brave.initialize(config);
    this.add(brave, true);
  }
}
