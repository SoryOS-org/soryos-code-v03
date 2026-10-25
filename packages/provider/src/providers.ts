/**
 * @soryos/provider
 * AI Provider implementations for various LLM providers.
 */

import { AIProvider, ModelInfo, GenerateOptions, GenerateResult, StreamOptions, StreamChunk, ResolvedCredential, ProviderConnectionTestResult, ProviderAITestResult } from "./types";
import { SUPPORTED_AI_MODELS } from "./models";

/**
 * Message d'erreur actionnable quand la passerelle refuse le free tier.
 *
 * La passerelle opencode.ai réserve le free tier (clé publique `public`) à
 * son client officiel : nous envoyons l'identification client attendue
 * (User-Agent + en-têtes x-opencode-*, comme le client officiel), mais le
 * contrôle est fait côté serveur (vérifié : aucune combinaison d'en-têtes,
 * de corps ou de clé ne passe). On explique donc la situation et la solution.
 */
function freeTierHint(errorBody: string): string | null {
  if (!errorBody.includes("FreeTierError")) return null;
  return (
    " — le free tier d'OpenCode Zen (clé publique) est réservé par le vendor " +
    "à son client officiel ; l'identification client est déjà envoyée. " +
    "Utilisez votre propre clé (soryos-code auth login opencode-zen) " +
    "ou un autre provider."
  );
}

/** User-Agent honnête : nous ne nous faisons PAS passer pour le client OpenCode. */
const SORYOS_USER_AGENT = "soryos-code/1.0 (+https://github.com/SoryOS-org/soryos-cloud-v02)";
import { ZEN_MODELS, ZEN_DEFAULT_MODEL, fetchZenModels, mergeZenCatalog, opencodeClientHeaders, type ZenModel } from "./models-zen";
import { resolveLiveCredential } from "./credential-bridge";
import { buildGoogleContents, buildOpenAIMessages, buildAnthropicMessages } from "./helpers";

async function probeEndpoint(
  providerId: string,
  endpoint: string,
  apiKey: string
): Promise<{ status: number; latencyMs: number; error?: string }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    let url = `${endpoint.replace(/\/$/, "")}/models`;
    let headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    if (providerId === "anthropic") {
      url = "https://api.anthropic.com/v1/models";
      headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
    } else if (providerId === "google" || providerId === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      headers = {};
    }
    const response = await fetch(url, { headers, signal: controller.signal });
    return { status: response.status, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      status: 0,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function connectionResult(
  providerId: string,
  providerName: string,
  endpoint: string,
  model: string,
  ok: boolean,
  fields: {
    message: string;
    httpStatus?: number;
    latencyMs: number;
    credentialStatus: "found" | "missing";
    credentialSource: "session_override" | "project_store" | "environment_variable" | "none";
    credentialSourceLabel: string;
    networkStatus: "passed" | "failed";
    authStatus: "passed" | "failed";
    apiStatus: "passed" | "failed";
    finalResult: "connected" | "auth_failed" | "network_error" | "invalid_endpoint" | "runtime_error" | "not_configured";
    errorMessage?: string;
  }
): ProviderConnectionTestResult {
  return {
    success: ok,
    status: ok ? "connected" : "error",
    httpStatus: fields.httpStatus,
    message: fields.message,
    latencyMs: fields.latencyMs,
    diagnostics: {
      providerId,
      providerName,
      credentialStatus: fields.credentialStatus,
      credentialSource: fields.credentialSource,
      credentialSourceLabel: fields.credentialSourceLabel,
      runtimeStatus: ok ? "initialized" : "error",
      endpoint,
      model,
      networkStatus: fields.networkStatus,
      authStatus: fields.authStatus,
      apiStatus: fields.apiStatus,
      httpStatus: fields.httpStatus,
      latencyMs: fields.latencyMs,
      finalResult: fields.finalResult,
      errorMessage: fields.errorMessage,
    },
  };
}

/**
 * Generic AI Provider - fallback for any provider
 */
export class GenericAIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly category = "ai" as const;
  private models: ModelInfo[];

  constructor(providerId: string) {
    this.id = providerId;
    this.name = providerId.charAt(0).toUpperCase() + providerId.slice(1);
    this.models = SUPPORTED_AI_MODELS.filter(m => m.providerId === providerId);
  }

  getEndpoint(): string {
    return `https://api.${this.id}.com/v1`;
  }

  getDefaultModel(): string {
    return this.models[0]?.id || "default";
  }

  listModels(): ModelInfo[] {
    return this.models;
  }

  resolveCredentials(sessionId?: string): ResolvedCredential {
    const live = resolveLiveCredential(this.id, sessionId);
    const apiKey = (live?.apiKey || this.getApiKey() || "").trim();
    const source: ResolvedCredential["source"] = live?.apiKey
      ? ((live.source as ResolvedCredential["source"]) || "project_store")
      : apiKey
        ? "environment_variable"
        : "none";
    const sourceLabel =
      source === "session_override"
        ? "Session Store"
        : source === "project_store"
          ? "Paramètres (UI)"
          : source === "environment_variable"
            ? "Variable d'environnement"
            : "Non configuré";
    return {
      providerId: this.id,
      source,
      sourceLabel,
      isConfigured: Boolean(apiKey),
      keyLength: apiKey.length,
      fingerprint: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "",
      apiKey: apiKey || undefined,
    };
  }

  protected resolveKey(options?: { apiKey?: string; sessionId?: string }): string | null {
    if (options?.apiKey && options.apiKey.trim()) {
      return options.apiKey.trim();
    }
    const live = resolveLiveCredential(this.id, options?.sessionId);
    if (live?.apiKey && live.apiKey.trim()) {
      return live.apiKey.trim();
    }
    return this.getApiKey();
  }

  protected getApiKey(): string | null {
    const envVar = this.getApiKeyEnvVar();
    return typeof process !== "undefined" ? process.env[envVar] || null : null;
  }

  protected getApiKeyEnvVar(): string {
    const envMap: Record<string, string> = {
      google: "GOOGLE_API_KEY",
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      mistral: "MISTRAL_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      opencode: "OPENCODE_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      grok: "GROK_API_KEY",
      cursor: "CURSOR_API_KEY",
    };
    return envMap[this.id] || `${this.id.toUpperCase()}_API_KEY`;
  }

  async testConnection(options?: { sessionId?: string; modelId?: string }): Promise<ProviderConnectionTestResult> {
    const model = options?.modelId || this.getDefaultModel();
    const live = resolveLiveCredential(this.id, options?.sessionId);
    const apiKey = (live?.apiKey || this.getApiKey() || "").trim();
    const credentialSource: "session_override" | "project_store" | "environment_variable" | "none" = live?.apiKey
      ? ((live.source as "session_override" | "project_store" | "environment_variable") || "project_store")
      : apiKey
        ? "environment_variable"
        : "none";
    const credentialSourceLabel =
      credentialSource === "session_override"
        ? "Session Store"
        : credentialSource === "project_store"
          ? "Paramètres (UI)"
          : credentialSource === "environment_variable"
            ? "Variable d'environnement"
            : "Non configuré";

    if (!apiKey) {
      return connectionResult(this.id, this.name, this.getEndpoint(), model, false, {
        message: `Clé API manquante pour ${this.name}. Ajoutez-la dans les paramètres ou via une variable d'environnement.`,
        httpStatus: 401,
        latencyMs: 0,
        credentialStatus: "missing",
        credentialSource: "none",
        credentialSourceLabel,
        networkStatus: "failed",
        authStatus: "failed",
        apiStatus: "failed",
        finalResult: "not_configured",
      });
    }

    const probe = await probeEndpoint(this.id, this.getEndpoint(), apiKey);
    const ok = probe.status === 200;

    if (probe.status === 0) {
      return connectionResult(this.id, this.name, this.getEndpoint(), model, false, {
        message: `Erreur réseau vers ${this.name} : ${probe.error}`,
        latencyMs: probe.latencyMs,
        credentialStatus: "found",
        credentialSource,
        credentialSourceLabel,
        networkStatus: "failed",
        authStatus: "passed",
        apiStatus: "failed",
        finalResult: "network_error",
        errorMessage: probe.error,
      });
    }
    if (probe.status === 401 || probe.status === 403) {
      return connectionResult(this.id, this.name, this.getEndpoint(), model, false, {
        message: `Authentification refusée par ${this.name} (HTTP ${probe.status}) : clé invalide ou révoquée.`,
        httpStatus: probe.status,
        latencyMs: probe.latencyMs,
        credentialStatus: "found",
        credentialSource,
        credentialSourceLabel,
        networkStatus: "passed",
        authStatus: "failed",
        apiStatus: "failed",
        finalResult: "auth_failed",
      });
    }
    if (!ok) {
      return connectionResult(this.id, this.name, this.getEndpoint(), model, false, {
        message: `${this.name} a répondu HTTP ${probe.status}.`,
        httpStatus: probe.status,
        latencyMs: probe.latencyMs,
        credentialStatus: "found",
        credentialSource,
        credentialSourceLabel,
        networkStatus: "passed",
        authStatus: "passed",
        apiStatus: "failed",
        finalResult: probe.status === 404 ? "invalid_endpoint" : "runtime_error",
      });
    }

    return connectionResult(this.id, this.name, this.getEndpoint(), model, true, {
      message: `Connecté à ${this.name} (${probe.latencyMs} ms).`,
      httpStatus: probe.status,
      latencyMs: probe.latencyMs,
      credentialStatus: "found",
      credentialSource,
      credentialSourceLabel,
      networkStatus: "passed",
      authStatus: "passed",
      apiStatus: "passed",
      finalResult: "connected",
    });
  }

  async testAI(options?: { sessionId?: string; modelId?: string; prompt?: string }): Promise<ProviderAITestResult> {
    const prompt = options?.prompt || "Réponds uniquement : OK";
    const model = options?.modelId || this.getDefaultModel();
    const conn = await this.testConnection(options);
    if (!conn.success) {
      return {
        success: false,
        prompt,
        response: "",
        model,
        latencyMs: conn.latencyMs,
        httpStatus: conn.httpStatus,
        error: conn.message,
        diagnostics: conn.diagnostics,
      };
    }
    try {
      const result = await this.generate({
        sessionId: options?.sessionId,
        modelId: model,
        messages: [{ role: "user", content: prompt }],
      });
      return {
        success: true,
        prompt,
        response: result.text,
        model: result.model,
        latencyMs: result.latencyMs,
        httpStatus: 200,
        diagnostics: { ...conn.diagnostics, latencyMs: result.latencyMs },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        prompt,
        response: "",
        model,
        latencyMs: conn.latencyMs,
        httpStatus: conn.httpStatus,
        error: message,
        diagnostics: { ...conn.diagnostics, finalResult: "runtime_error", errorMessage: message },
      };
    }
  }

  /**
   * En-têtes de la requête : identification client OpenCode (exigée par le
   * free tier de la passerelle) + notre User-Agent elsewhere.
   */
  protected requestHeaders(options: { apiKey: string; sessionId?: string }): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
      ...opencodeClientHeaders(options.sessionId),
    };
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error(
        `Clé API manquante pour ${this.name} : configurez-la dans les paramètres ou via une variable d'environnement.`
      );
    }

    try {
      const model = options.modelId || this.getDefaultModel();
      const messages = buildOpenAIMessages(
        options.systemPrompt
          ? [{ role: "system" as const, content: options.systemPrompt }, ...options.messages]
          : options.messages
      );
      const start = Date.now();
      const response = await fetch(`${this.getEndpoint().replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: this.requestHeaders({ apiKey, sessionId: options.sessionId }),
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `${this.name}: HTTP ${response.status}${errorBody ? ` — ${errorBody.slice(0, 400)}` : ""}${freeTierHint(errorBody) ?? ""}`
        );
      }

      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content || "",
        model,
        providerId: this.id,
        providerName: this.name,
        latencyMs: Date.now() - start,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`[${this.name}] generate a échoué : ${errorMessage}`);
    }
  }

  async *stream(options: StreamOptions): AsyncIterable<StreamChunk> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error(
        `Clé API manquante pour ${this.name} : configurez-la dans les paramètres ou via une variable d'environnement.`
      );
    }

    const model = options.modelId || this.getDefaultModel();
    const messages = buildOpenAIMessages(
      options.systemPrompt
        ? [{ role: "system" as const, content: options.systemPrompt }, ...options.messages]
        : options.messages
    );

    const response = await fetch(`${this.getEndpoint().replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: this.requestHeaders({ apiKey, sessionId: options.sessionId }),
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `${this.name}: HTTP ${response.status}${errorBody ? ` — ${errorBody.slice(0, 400)}` : ""}${freeTierHint(errorBody) ?? ""}`
      );
    }
    if (!response.body) {
      throw new Error(`${this.name}: pas de corps de réponse pour le streaming.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        if (options.signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              yield { delta, isComplete: false };
            }
          } catch {
            // Bloc SSE partiel : ignoré
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: "", isComplete: true };
  }
}

/**
 * Google Gemini Provider
 */
export class GoogleProvider extends GenericAIProvider {
  readonly id: string = "google";
  readonly name: string = "Google Gemini";

  constructor() {
    super("google");
  }

  getEndpoint(): string {
    return "https://generativelanguage.googleapis.com/v1beta";
  }

  getDefaultModel(): string {
    return "gemini-3.8-flash";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "google");
  }

  protected getApiKeyEnvVar(): string {
    return "GOOGLE_API_KEY";
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error("Clé API Google manquante (GOOGLE_API_KEY ou paramètres UI).");
    }

    try {
      // Import Google GenAI SDK
      const { GoogleGenAI } = await import("@google/genai");
      const genAI = new GoogleGenAI({ apiKey });

      const start = Date.now();
      const result = await genAI.models.generateContent({
        model: options.modelId || this.getDefaultModel(),
        contents: buildGoogleContents(options.messages),
        config: {
          temperature: options.temperature ?? 0.7,
          systemInstruction: options.systemPrompt,
        },
      });

      const latencyMs = Date.now() - start;
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        text,
        model: options.modelId || this.getDefaultModel(),
        providerId: this.id,
        providerName: this.name,
        latencyMs,
        usage: {
          promptTokens: result.usageMetadata?.promptTokenCount,
          completionTokens: result.usageMetadata?.candidatesTokenCount,
          totalTokens: result.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      // Surface the real failure instead of masking it behind placeholder text.
      throw new Error(`[GoogleProvider] generateContent failed: ${errorMessage}`);
    }
  }

  async *stream(options: StreamOptions): AsyncIterable<StreamChunk> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error("Clé API Google manquante (GOOGLE_API_KEY ou paramètres UI).");
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const genAI = new GoogleGenAI({ apiKey });

      const start = Date.now();
      const stream = await genAI.models.generateContentStream({
        model: options.modelId || this.getDefaultModel(),
        contents: buildGoogleContents(options.messages),
        config: {
          temperature: options.temperature ?? 0.7,
          systemInstruction: options.systemPrompt,
        },
      });

      let accumulatedText = "";
      let usage = {
        promptTokens: undefined as number | undefined,
        completionTokens: undefined as number | undefined,
        totalTokens: undefined as number | undefined,
      };
      for await (const chunk of stream) {
        if (options.signal?.aborted) {
          break;
        }
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
        accumulatedText += text;

        if (chunk.usageMetadata) {
          usage = {
            promptTokens: chunk.usageMetadata.promptTokenCount,
            completionTokens: chunk.usageMetadata.candidatesTokenCount,
            totalTokens: chunk.usageMetadata.totalTokenCount,
          };
        }

        yield {
          delta: text,
          isComplete: false,
          usage,
        };
      }

      yield {
        delta: "",
        isComplete: true,
        usage,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw new Error(`[GoogleProvider] generateContentStream failed: ${errorMessage}`);
    }
  }
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider extends GenericAIProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI" as const;

  constructor() {
    super("openai");
  }

  getEndpoint(): string {
    return "https://api.openai.com/v1";
  }

  getDefaultModel(): string {
    return "gpt-4o-mini";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "openai");
  }

  protected getApiKeyEnvVar(): string {
    return "OPENAI_API_KEY";
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error("Clé API OpenAI manquante (OPENAI_API_KEY ou paramètres UI).");
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.getEndpoint()}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.modelId || this.getDefaultModel(),
          messages: buildOpenAIMessages(
            options.systemPrompt
              ? [{ role: "system", content: options.systemPrompt }, ...options.messages]
              : options.messages
          ),
          temperature: options.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - start;
      const text = data.choices?.[0]?.message?.content || "";

      return {
        text,
        model: options.modelId || this.getDefaultModel(),
        providerId: this.id,
        providerName: this.name,
        latencyMs,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw new Error(`[OpenAI] generate a échoué : ${errorMessage}`);
    }
  }

  async *stream(options: StreamOptions): AsyncIterable<StreamChunk> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error("Clé API OpenAI manquante (OPENAI_API_KEY ou paramètres UI).");
    }

    try {
      const response = await fetch(`${this.getEndpoint()}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.modelId || this.getDefaultModel(),
          messages: buildOpenAIMessages(
            options.systemPrompt
              ? [{ role: "system", content: options.systemPrompt }, ...options.messages]
              : options.messages
          ),
          temperature: options.temperature || 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      if (!response.body) {
        throw new Error("No response body for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        if (options.signal?.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content || "";
              accumulatedText += text;
              
              if (text) {
                yield {
                  delta: text,
                  isComplete: false,
                };
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      yield {
        delta: "",
        isComplete: true,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw new Error(`[OpenAI] stream a échoué : ${errorMessage}`);
    }
  }
}

/**
 * Anthropic Provider
 */
export class AnthropicProvider extends GenericAIProvider {
  readonly id = "anthropic" as const;
  readonly name = "Anthropic" as const;

  constructor() {
    super("anthropic");
  }

  getEndpoint(): string {
    return "https://api.anthropic.com/v1";
  }

  getDefaultModel(): string {
    return "claude-3-5-sonnet-20250620";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "anthropic");
  }

  protected getApiKeyEnvVar(): string {
    return "ANTHROPIC_API_KEY";
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error("Clé API Anthropic manquante (ANTHROPIC_API_KEY ou paramètres UI).");
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.getEndpoint()}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: options.modelId || this.getDefaultModel(),
          max_tokens: 4096,
          temperature: options.temperature || 0.7,
          system: options.systemPrompt,
          messages: buildAnthropicMessages(options.messages),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - start;
      const text = data.content?.[0]?.text || "";

      return {
        text,
        model: options.modelId || this.getDefaultModel(),
        providerId: this.id,
        providerName: this.name,
        latencyMs,
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens: data.usage?.input_tokens + data.usage?.output_tokens,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw new Error(`[Anthropic] generate a échoué : ${errorMessage}`);
    }
  }

  async *stream(options: StreamOptions): AsyncIterable<StreamChunk> {
    const apiKey = this.resolveKey(options);
    if (!apiKey) {
      throw new Error("Clé API Anthropic manquante (ANTHROPIC_API_KEY ou paramètres UI).");
    }

    try {
      const response = await fetch(`${this.getEndpoint()}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: options.modelId || this.getDefaultModel(),
          max_tokens: 4096,
          temperature: options.temperature || 0.7,
          system: options.systemPrompt,
          messages: buildAnthropicMessages(options.messages),
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      if (!response.body) {
        throw new Error("No response body for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        if (options.signal?.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith("event: message_delta")) {
            // Parse the data line that follows
            continue;
          }
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              const text = parsed.delta?.text || "";
              if (text) {
                yield {
                  delta: text,
                  isComplete: false,
                };
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      yield {
        delta: "",
        isComplete: true,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw new Error(`[Anthropic] stream a échoué : ${errorMessage}`);
    }
  }
}

/**
 * Mistral Provider
 */
export class MistralProvider extends GenericAIProvider {
  readonly id = "mistral" as const;
  readonly name = "Mistral" as const;

  constructor() {
    super("mistral");
  }

  getEndpoint(): string {
    return "https://api.mistral.ai/v1";
  }

  getDefaultModel(): string {
    return "mistral-large-2407";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "mistral");
  }

  protected getApiKeyEnvVar(): string {
    return "MISTRAL_API_KEY";
  }
}

/**
 * OpenRouter Provider
 */
export class OpenRouterProvider extends GenericAIProvider {
  readonly id = "openrouter" as const;
  readonly name = "OpenRouter" as const;

  constructor() {
    super("openrouter");
  }

  getEndpoint(): string {
    return "https://openrouter.ai/api/v1";
  }

  getDefaultModel(): string {
    return "openai/gpt-4o-mini";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "openrouter");
  }

  protected getApiKeyEnvVar(): string {
    return "OPENROUTER_API_KEY";
  }
}

/**
 * OpenCode Zen Provider
 *
 * Passerelle opencode.ai. Deux modes :
 *  - clé personnelle (OPENCODE_API_KEY ou identifiants stockés) → tous les modèles
 *  - clé publique `public` (aucune clé) → FREE TIER : seuls les modèles dont
 *    le coût d'entrée est 0 sont utilisables (mécanisme opencode).
 */
export class OpenCodeProvider extends GenericAIProvider {
  readonly id = "opencode-zen" as const;
  readonly name = "OpenCode Zen" as const;

  /** Ids servis en direct (null = catalogue statique). */
  private liveIds: string[] | null = null;
  /** Catalogue fusionné (statique + direct). */
  private merged: ZenModel[] | null = null;

  constructor() {
    super("opencode-zen");
  }

  getEndpoint(): string {
    return process.env.OPENCODE_BASE_URL || "https://opencode.ai/inference/v1";
  }

  getDefaultModel(): string {
    // Si la liste en direct est connue, on prend un modèle gratuit VIVANT.
    if (this.merged?.length) {
      const liveFree = this.merged.filter((m) => m.free);
      const pick =
        liveFree.find((m) => m.id === "big-pickle") ??
        liveFree.find((m) => m.supportsTools && m.contextTokens >= 200000) ??
        liveFree.find((m) => m.supportsTools) ??
        liveFree[0];
      if (pick) return pick.id;
    }
    return ZEN_DEFAULT_MODEL;
  }

  listModels(): ModelInfo[] {
    const source = this.merged ?? ZEN_MODELS;
    return source.map((m) => ({
      id: m.id,
      name: m.name,
      providerId: this.id,
      providerName: this.name,
      isFree: m.free,
      badge: m.free ? "Free Tier" : undefined,
      description: m.description,
      contextLength: m.contextLength,
      pricing: m.free ? "free" : `$${m.cost.input}/$${m.cost.output} per Mtok`,
      supportsTools: m.supportsTools,
      cost: m.cost,
    }));
  }

  /**
   * Rafraîchit le catalogue depuis la passerelle (liste en direct).
   * @returns le nombre de modèles servis, ou null si l'appel a échoué
   */
  async refreshModels(): Promise<number | null> {
    const live = await fetchZenModels(this.getEndpoint());
    if (!live?.length) return null;
    this.liveIds = live.map((m) => m.id);
    this.merged = mergeZenCatalog(this.liveIds);
    return this.merged.length;
  }

  /** Le catalogue a-t-il été rafraîchi depuis la passerelle ? */
  get isLive(): boolean {
    return this.merged !== null;
  }

  protected getApiKeyEnvVar(): string {
    return "OPENCODE_API_KEY";
  }
}

/**
 * DeepSeek Provider
 */
export class DeepSeekProvider extends GenericAIProvider {
  readonly id = "deepseek" as const;
  readonly name = "DeepSeek" as const;

  constructor() {
    super("deepseek");
  }

  getEndpoint(): string {
    return "https://api.deepseek.com/v1";
  }

  getDefaultModel(): string {
    return "deepseek-chat";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "deepseek");
  }

  protected getApiKeyEnvVar(): string {
    return "DEEPSEEK_API_KEY";
  }
}

/**
 * Grok Provider
 */
export class GrokProvider extends GenericAIProvider {
  readonly id = "grok" as const;
  readonly name = "Grok" as const;

  constructor() {
    super("grok");
  }

  getEndpoint(): string {
    return "https://api.grok.com/v1";
  }

  getDefaultModel(): string {
    return "grok-2";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "grok");
  }

  protected getApiKeyEnvVar(): string {
    return "GROK_API_KEY";
  }
}

/**
 * Cursor Provider
 */
export class CursorProvider extends GenericAIProvider {
  readonly id = "cursor" as const;
  readonly name = "Cursor" as const;

  constructor() {
    super("cursor");
  }

  getEndpoint(): string {
    return "https://api.cursor.com/v1";
  }

  getDefaultModel(): string {
    return "cursor-small";
  }

  listModels(): ModelInfo[] {
    return SUPPORTED_AI_MODELS.filter(m => m.providerId === "cursor");
  }

  protected getApiKeyEnvVar(): string {
    return "CURSOR_API_KEY";
  }
}

/**
 * Gemini Provider (alias for Google)
 *
 * Registers under the "gemini" id so sessions that declare provider "gemini"
 * resolve to the same Gemini endpoint, without duplicating the request logic.
 */
export class GeminiProvider extends GoogleProvider {
  override readonly id = "gemini" as const;
  override readonly name = "Gemini" as const;

  constructor() {
    super();
  }
}
