import type { ModelInfo } from "./models";

export type ProviderId =
  | "google"
  | "anthropic"
  | "openai"
  | "mistral"
  | "openrouter"
  | "opencode-zen"
  | "deepseek"
  | "grok"
  | "cursor";

export type CredentialSource =
  | "session_override"
  | "project_store"
  | "environment_variable"
  | "public_default"
  | "none";

export interface ResolvedCredential {
  providerId: string;
  source: CredentialSource;
  sourceLabel: string;
  isConfigured: boolean;
  keyLength: number;
  fingerprint: string;
  apiKey?: string;
  extraFields?: Record<string, string>;
}

export type FinalDiagnosticResult =
  | "connected"
  | "auth_failed"
  | "network_error"
  | "invalid_model"
  | "invalid_endpoint"
  | "runtime_error"
  | "not_configured";

export interface ProviderDiagnosticsResult {
  providerId: string;
  providerName: string;
  credentialStatus: "found" | "missing";
  credentialSource: CredentialSource;
  credentialSourceLabel: string;
  keyLength?: number;
  keyFingerprint?: string;
  runtimeStatus: "initialized" | "error";
  endpoint: string;
  model: string;
  networkStatus: "pending" | "passed" | "failed";
  authStatus: "pending" | "passed" | "failed";
  apiStatus: "pending" | "passed" | "failed";
  httpStatus?: number;
  latencyMs?: number;
  finalResult: FinalDiagnosticResult;
  errorMessage?: string;
  rawErrorDetails?: {
    statusCode?: number;
    errorType?: string;
    message?: string;
    endpoint?: string;
  };
}

export interface ProviderConnectionTestResult {
  success: boolean;
  status: "connected" | "error";
  httpStatus?: number;
  message: string;
  latencyMs: number;
  diagnostics: ProviderDiagnosticsResult;
}

export interface ProviderAITestResult {
  success: boolean;
  prompt: string;
  response: string;
  model: string;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
  diagnostics: ProviderDiagnosticsResult;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** Vision input: base64 raw data (no data: prefix), provider-mapped. */
  images?: Array<{ mimeType: string; data: string }>;
}

export interface GenerateOptions {
  sessionId?: string;
  modelId?: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  apiKey?: string;
}

export interface GenerateResult {
  text: string;
  model: string;
  providerId: string;
  providerName: string;
  latencyMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface StreamOptions extends GenerateOptions {
  signal?: AbortSignal;
}

export interface StreamChunk {
  delta: string;
  isComplete: boolean;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIProvider {
  readonly id: ProviderId | string;
  readonly name: string;
  readonly category: "ai";

  getEndpoint(): string;
  getDefaultModel(): string;
  listModels(): ModelInfo[];

  resolveCredentials(sessionId?: string): ResolvedCredential;

  testConnection(options?: {
    sessionId?: string;
    modelId?: string;
  }): Promise<ProviderConnectionTestResult>;

  testAI(options?: {
    sessionId?: string;
    modelId?: string;
    prompt?: string;
  }): Promise<ProviderAITestResult>;

  generate(options: GenerateOptions): Promise<GenerateResult>;

  stream(options: StreamOptions): AsyncIterable<StreamChunk>;
}

// Re-exported so consumers can import the whole provider contract from here.
export type { ModelInfo } from "./models";
