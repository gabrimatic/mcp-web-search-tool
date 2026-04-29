import { BraveSearchProvider } from './BraveSearchProvider.js';
import { DuckDuckGoProvider } from './DuckDuckGoProvider.js';
import type { SearchProvider, SearchProviderConfig } from './SearchProvider.js';

export class SearchProviderFactory {
  private static providers = new Map<string, SearchProvider>();
  private static defaultProviderName: string | null = null;

  static add(provider: SearchProvider, makeDefault = false): void {
    const name = provider.getName().toLowerCase();
    this.providers.set(name, provider);
    if (makeDefault || !this.defaultProviderName) {
      this.defaultProviderName = name;
    }
  }

  static get(name: string): SearchProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) throw new Error(`Provider not found: ${name}`);
    return provider;
  }

  static getDefault(): SearchProvider {
    if (!this.defaultProviderName || this.providers.size === 0) {
      throw new Error('No search providers available');
    }
    return this.get(this.defaultProviderName);
  }

  static setDefault(name: string): void {
    this.get(name);
    this.defaultProviderName = name.toLowerCase();
  }

  static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Register the default set of providers. Brave is the primary provider when
   * an API key is present; DuckDuckGo (keyless) is always registered as a
   * fallback so the server is usable without configuration.
   */
  static setupDefaults(config: SearchProviderConfig): void {
    if (config.apiKey) {
      const brave = new BraveSearchProvider();
      brave.initialize(config);
      this.add(brave, true);
    }
    const ddg = new DuckDuckGoProvider();
    ddg.initialize(config);
    this.add(ddg, !config.apiKey);
  }
}
