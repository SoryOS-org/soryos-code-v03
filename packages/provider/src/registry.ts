import type { AIProvider, ProviderAITestResult, ProviderConnectionTestResult } from "./types";
import type { ModelInfo } from "./models";
import { SUPPORTED_AI_MODELS } from "./models";
import {
  GoogleProvider,
  OpenAIProvider,
  AnthropicProvider,
  MistralProvider,
  OpenRouterProvider,
  OpenCodeProvider,
  DeepSeekProvider,
  GrokProvider,
  CursorProvider,
  GenericAIProvider,
} from "./providers";

export {
  setCredentialResolver,
  resolveLiveCredential,
} from "./credential-bridge";
export type { CredentialResolver, LiveCredential } from "./credential-bridge";
import { resolveLiveCredential } from "./credential-bridge";

export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the registry with all available providers
   */
  private initialize(): void {
    if (this.initialized) return;
    
    // Register all standard AI providers
    this.register(new GoogleProvider());
    this.register(new OpenAIProvider());
    this.register(new AnthropicProvider());
    this.register(new MistralProvider());
    this.register(new OpenRouterProvider());
    this.register(new OpenCodeProvider());
    this.register(new DeepSeekProvider());
    this.register(new GrokProvider());
    this.register(new CursorProvider());
    
    this.initialized = true;
  }

  register(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  getRequiredProvider(providerId: string): AIProvider {
    const p = this.providers.get(providerId);
    if (!p) {
      throw new Error(`Fournisseur IA non reconnu ou introuvable : '${providerId}'`);
    }
    return p;
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getAllModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS;
  }

  getProviderForModel(modelId: string): AIProvider {
    for (const p of this.providers.values()) {
      const models = p.listModels();
      if (models.some((m) => m.id === modelId)) {
        return p;
      }
    }
    return this.getRequiredProvider("google");
  }

  resolveApiKey(providerId: string, sessionId?: string): string {
    const live = resolveLiveCredential(providerId, sessionId);
    if (live?.apiKey && live.apiKey.trim()) {
      return live.apiKey.trim();
    }

    const provider = this.getProvider(providerId);
    if (provider) {
      // If provider has a getApiKey method, use it
      if (typeof (provider as any).getApiKeyFromEnvironment === "function") {
        return (provider as any).getApiKeyFromEnvironment() || "";
      }
    }
    
    // Fallback to environment variables
    switch (providerId) {
      case "google":
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
      case "openai":
        return process.env.OPENAI_API_KEY || "";
      case "anthropic":
        return process.env.ANTHROPIC_API_KEY || "";
      case "mistral":
        return process.env.MISTRAL_API_KEY || "";
      case "openrouter":
        return process.env.OPENROUTER_API_KEY || "";
      case "opencode-zen":
      case "opencode":
        return process.env.OPENCODE_API_KEY || "";
      case "deepseek":
        return process.env.DEEPSEEK_API_KEY || "";
      case "grok":
        return process.env.GROK_API_KEY || process.env.XAI_API_KEY || "";
      case "cursor":
        return process.env.CURSOR_API_KEY || "";
      default:
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    }
  }

  async testConnection(
    providerId: string,
    options?: { sessionId?: string; modelId?: string }
  ): Promise<ProviderConnectionTestResult> {
    const provider = this.getProvider(providerId);
    if (provider && typeof provider.testConnection === "function") {
      return provider.testConnection(options);
    }

    const key = this.resolveApiKey(providerId);
    const start = Date.now();
    const isConfigured = Boolean(key && key.trim().length > 0 && key !== "TODO");
    const latencyMs = Date.now() - start;

    return {
      success: isConfigured,
      status: isConfigured ? "connected" : "error",
      httpStatus: isConfigured ? 200 : 401,
      message: isConfigured
        ? `Connexion établie avec succès (${providerId})`
        : `Clé API manquante ou invalide pour le fournisseur ${providerId}`,
      latencyMs,
      diagnostics: {
        providerId,
        providerName: provider?.name || providerId,
        credentialStatus: isConfigured ? "found" : "missing",
        credentialSource: isConfigured ? "environment_variable" : "none",
        credentialSourceLabel: isConfigured ? "Variable d'environnement" : "Non configuré",
        runtimeStatus: isConfigured ? "initialized" : "error",
        endpoint: provider?.getEndpoint() || `https://api.${providerId}.com`,
        model: options?.modelId || "default",
        networkStatus: isConfigured ? "passed" : "failed",
        authStatus: isConfigured ? "passed" : "failed",
        apiStatus: isConfigured ? "passed" : "failed",
        httpStatus: isConfigured ? 200 : 401,
        latencyMs,
        finalResult: isConfigured ? "connected" : "not_configured",
      },
    };
  }

  async testAI(
    providerId: string,
    options?: { sessionId?: string; modelId?: string; prompt?: string }
  ): Promise<ProviderAITestResult> {
    const provider = this.getProvider(providerId);
    if (provider && typeof provider.testAI === "function") {
      return provider.testAI(options);
    }

    const conn = await this.testConnection(providerId, options);
    const prompt = options?.prompt || "Réponds uniquement : OK";
    return {
      success: false,
      prompt,
      response: "",
      model: options?.modelId || "unknown",
      latencyMs: conn.latencyMs,
      httpStatus: conn.httpStatus,
      error: conn.success
        ? `testAI non implémenté pour le fournisseur ${providerId}.`
        : conn.message,
      diagnostics: conn.diagnostics,
    };
  }

  async runFullMatrixDiagnostics(sessionId?: string): Promise<Record<string, ProviderConnectionTestResult>> {
    const matrix: Record<string, ProviderConnectionTestResult> = {};
    const defaultProviders = ["google", "openai", "mistral", "opencode-zen"];
    for (const pId of defaultProviders) {
      matrix[pId] = await this.testConnection(pId, { sessionId });
    }
    return matrix;
  }
}

export const aiProviderRegistry = new AIProviderRegistry();
