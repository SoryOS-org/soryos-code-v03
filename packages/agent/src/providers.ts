/**
 * @soryos/agent
 * AI Provider registry and management.
 */

import { AIProvider, ProviderId, GenericAIProvider, AnthropicProvider, GoogleProvider, OpenAIProvider, CursorProvider, GeminiProvider } from '@soryos/provider';
import { AgentDefaultsConfig, DEFAULT_AGENT_CONFIG } from './config';

/**
 * Agent Provider Registry
 * 
 * Manages all AI providers available for the agent.
 */
export class AgentProviderRegistry {
  private providers = new Map<ProviderId | string, AIProvider>();
  private config: AgentDefaultsConfig;

  constructor(config: Partial<AgentDefaultsConfig> = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    // Pre-register standard providers
    try {
      this.register(new AnthropicProvider());
      this.register(new GoogleProvider());
      this.register(new OpenAIProvider());
      this.register(new CursorProvider());
      this.register(new GeminiProvider());
    } catch {
      // fallback
    }
  }

  /**
   * Register a provider
   */
  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by ID
   */
  get(id: ProviderId | string): AIProvider | undefined {
    let p = this.providers.get(id);
    if (!p) {
      p = new GenericAIProvider(id);
      this.providers.set(id, p);
    }
    return p;
  }

  /**
   * Get all registered providers
   */
  getAll(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider by model
   */
  getByModel(model: string): AIProvider | undefined {
    for (const provider of this.providers.values()) {
      const models = provider.listModels();
      if (models.some(m => m.id === model)) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Get the default provider
   */
  getDefault(): AIProvider | undefined {
    return this.get(this.config.defaultProvider as ProviderId);
  }

  /**
   * Check if a provider is registered
   */
  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  /**
   * Get provider configuration
   */
  getConfig(): AgentDefaultsConfig {
    return { ...this.config };
  }

  /**
   * Update provider configuration
   */
  updateConfig(config: Partial<AgentDefaultsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Remove a provider
   */
  remove(id: ProviderId): boolean {
    return this.providers.delete(id);
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
  }
}

/**
 * Singleton instance
 */
export const agentProviderRegistry = new AgentProviderRegistry();

/**
 * Initialize the agent provider registry with default providers
 */
export async function initializeAgentProviders(): Promise<void> {
  // Import and register default providers
  try {
    const { AnthropicProvider } = await import('@soryos/provider');
    agentProviderRegistry.register(new AnthropicProvider());
    console.log('[Agent] Registered Anthropic provider');
  } catch (error) {
    console.warn('[Agent] Failed to register Anthropic provider:', error);
  }

  try {
    const { GoogleProvider } = await import('@soryos/provider');
    agentProviderRegistry.register(new GoogleProvider());
    console.log('[Agent] Registered Google provider');
  } catch (error) {
    console.warn('[Agent] Failed to register Google provider:', error);
  }

  try {
    const { OpenAIProvider } = await import('@soryos/provider');
    agentProviderRegistry.register(new OpenAIProvider());
    console.log('[Agent] Registered OpenAI provider');
  } catch (error) {
    console.warn('[Agent] Failed to register OpenAI provider:', error);
  }

  // Try to register Cursor and Gemini providers (new)
  try {
    const { CursorProvider } = await import('@soryos/provider');
    agentProviderRegistry.register(new CursorProvider());
    console.log('[Agent] Registered Cursor provider');
  } catch (error) {
    console.warn('[Agent] Failed to register Cursor provider:', error);
  }

  try {
    const { GeminiProvider } = await import('@soryos/provider');
    agentProviderRegistry.register(new GeminiProvider());
    console.log('[Agent] Registered Gemini provider');
  } catch (error) {
    console.warn('[Agent] Failed to register Gemini provider:', error);
  }
}
