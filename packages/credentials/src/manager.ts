import { computeFingerprint, maskSecret, setCredentialResolver } from "@soryos/provider";
import type { ResolvedCredential, CredentialSource } from "@soryos/provider";
import {
  readPersistedCredentials,
  writePersistedCredentials,
  removePersistedCredentials,
} from "./store";

export type AuthMethod = "github_oauth" | "api_key" | "api_token" | "service_account";

/**
 * Clé publique du gateway (OpenCode Zen).
 * Sans clé personnelle, la passerelle accepte `Bearer public` et ne sert
 * que le free tier (modèles à coût d'entrée nul).
 */
export const PUBLIC_GATEWAY_KEY = "public";

/** Cette clé est-elle la clé publique du gateway (free tier) ? */
export function isPublicGatewayKey(apiKey: string | undefined | null): boolean {
  return !apiKey || apiKey === PUBLIC_GATEWAY_KEY;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  category: "ai" | "sandbox" | "vcs";
  authenticationMethod: AuthMethod;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    type: "password" | "text" | "textarea";
    description?: string;
  }>;
}

export interface ProviderStatus {
  id: string;
  name: string;
  category: "ai" | "sandbox" | "vcs";
  authenticationMethod: AuthMethod;
  description: string;
  configured: boolean;
  source: CredentialSource;
  sourceLabel: string;
  keyLength: number;
  fingerprint: string;
  maskedKey?: string;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "error" | "untested";
  lastTestMessage?: string;
  httpStatus?: number;
  latencyMs?: number;
}

export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  google: {
    id: "google",
    name: "Google Gemini",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles Google Gemini 3.8 Flash, 3.1 Pro et 3.1 Flash Lite pour génération ultra-rapide.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API Google Gemini",
        placeholder: "AIzaSy... ou AQ.Ab8...",
        type: "password",
        description: "Clé API issue de Google AI Studio (aistudio.google.com)",
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles officiels OpenAI GPT-4o, GPT-4o Mini et o3-mini pour code et raisonnement.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API OpenAI",
        placeholder: "sk-proj-...",
        type: "password",
        description: "Clé API générée depuis platform.openai.com",
      },
    ],
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles Codestral, Mistral Large et Small optimisés pour le code et le multilingue.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API Mistral",
        placeholder: "...",
        type: "password",
        description: "Clé API générée depuis console.mistral.ai",
      },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Passerelle universelle donnant accès à Llama 3.3, DeepSeek R1, Qwen 2.5 et 100+ modèles.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API OpenRouter",
        placeholder: "sk-or-v1-...",
        type: "password",
        description: "Clé API OpenRouter (openrouter.ai). Modèles :free disponibles.",
      },
    ],
  },
  "opencode-zen": {
    id: "opencode-zen",
    name: "OpenCode Zen",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Passerelle OpenCode Zen pour modèles coding communautaires (Bearer public ou clé pro).",
    fields: [
      {
        key: "apiKey",
        label: "Clé OpenCode Zen",
        placeholder: "public ou votre clé personnelle",
        type: "password",
        description: "Laissez 'public' pour quota communautaire, ou votre clé OpenCode.",
      },
    ],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles DeepSeek V3 et R1 pour raisonnement mathématique et synthèse de code.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API DeepSeek",
        placeholder: "sk-...",
        type: "password",
        description: "Clé API générée depuis platform.deepseek.com",
      },
    ],
  },
  grok: {
    id: "grok",
    name: "xAI Grok",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles Grok-2 et Grok Beta avec raisonnement approfondi par xAI.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API xAI Grok",
        placeholder: "xai-...",
        type: "password",
        description: "Clé API générée depuis console.x.ai",
      },
    ],
  },
  e2b: {
    id: "e2b",
    name: "E2B Sandbox",
    category: "sandbox",
    authenticationMethod: "api_key",
    description: "Sandboxes sécurisées pour exécuter du code, des terminaux et des agents IA.",
    fields: [
      {
        key: "apiKey",
        label: "API Key E2B",
        placeholder: "e2b_********************************",
        type: "password",
        description: "Clé API générée depuis votre console e2b.dev",
      },
    ],
  },
  vercel: {
    id: "vercel",
    name: "Vercel Sandbox",
    category: "sandbox",
    authenticationMethod: "api_token",
    description: "Environnement d'exécution et de prévisualisation cloud serverless.",
    fields: [
      {
        key: "apiToken",
        label: "Vercel API Token",
        placeholder: "vercel_tok_************************",
        type: "password",
        description: "Personal Access Token Vercel avec accès Sandbox/Deployments",
      },
    ],
  },
  "google-cloud-run": {
    id: "google-cloud-run",
    name: "Google Cloud Run",
    category: "sandbox",
    authenticationMethod: "service_account",
    description: "Cloud Run Jobs pour compilations lourdes et conteneurs.",
    fields: [
      {
        key: "projectId",
        label: "GCP Project ID",
        placeholder: "my-gcp-project-123",
        type: "text",
        description: "Identifiant de votre projet Google Cloud",
      },
      {
        key: "serviceAccountKey",
        label: "Service Account JSON Key",
        placeholder: '{\n  "type": "service_account",\n  "project_id": "..."\n}',
        type: "textarea",
        description: "Clé JSON du compte de service GCP",
      },
    ],
  },
  "github-codespaces": {
    id: "github-codespaces",
    name: "GitHub",
    category: "vcs",
    authenticationMethod: "api_token",
    description: "Compte GitHub (Personal Access Token classic ou fine-grained) pour dépôts et Codespaces.",
    fields: [
      {
        key: "apiKey",
        label: "GitHub Personal Access Token",
        placeholder: "ghp_... ou github_pat_...",
        type: "password",
        description: "Scopes requis : repo, codespace, read:user",
      },
    ],
  },
};

declare global {
  var __soryos_credentials_store: Map<string, Record<string, string>> | undefined;
  var __soryos_session_credentials: Map<string, Map<string, Record<string, string>>> | undefined;
  var __soryos_credentials_tests: Map<
    string,
    { status: "success" | "error"; message: string; timestamp: string; httpStatus?: number; latencyMs?: number }
  > | undefined;
}

const credentialsStore = globalThis.__soryos_credentials_store ?? new Map<string, Record<string, string>>();
globalThis.__soryos_credentials_store = credentialsStore;

const sessionCredentialsStore =
  globalThis.__soryos_session_credentials ?? new Map<string, Map<string, Record<string, string>>>();
globalThis.__soryos_session_credentials = sessionCredentialsStore;

const testsStore =
  globalThis.__soryos_credentials_tests ??
  new Map<
    string,
    { status: "success" | "error"; message: string; timestamp: string; httpStatus?: number; latencyMs?: number }
  >();
globalThis.__soryos_credentials_tests = testsStore;

export class CredentialManager {
  /**
   * Resolves credential following strict priority order:
   * 1. Session / Project override
   * 2. Project / UI Store (configured through settings)
   * 3. Environment variable fallback
   * 4. Public default (only if specifically supported by provider like OpenCode Zen)
   * 5. Unconfigured (none)
   */
  resolveCredentials(providerId: string, sessionId?: string): ResolvedCredential {
    // 1. Session / Project override
    if (sessionId) {
      const sessionMap = sessionCredentialsStore.get(sessionId);
      const sessionCreds = sessionMap?.get(providerId);
      const sessionKey = sessionCreds?.apiKey || sessionCreds?.apiToken;
      if (sessionKey && sessionKey.trim().length > 0) {
        return {
          providerId,
          source: "session_override",
          sourceLabel: `Session Store (${sessionId.slice(0, 8)})`,
          isConfigured: true,
          keyLength: sessionKey.trim().length,
          fingerprint: computeFingerprint(sessionKey),
          apiKey: sessionKey.trim(),
          extraFields: sessionCreds,
        };
      }
    }

    // 2. Project / UI Store
    const storeCreds = credentialsStore.get(providerId);
    const storeKey = storeCreds?.apiKey || storeCreds?.apiToken;
    if (storeKey && storeKey.trim().length > 0) {
      return {
        providerId,
        source: "project_store",
        sourceLabel: "Project Settings Store",
        isConfigured: true,
        keyLength: storeKey.trim().length,
        fingerprint: computeFingerprint(storeKey),
        apiKey: storeKey.trim(),
        extraFields: storeCreds,
      };
    }

    // 3. Environment variable fallback
    const envKey = this.getEnvKeyForProvider(providerId);
    if (envKey && envKey.trim().length > 0) {
      return {
        providerId,
        source: "environment_variable",
        sourceLabel: `Env Var (${this.getEnvVarName(providerId)})`,
        isConfigured: true,
        keyLength: envKey.trim().length,
        fingerprint: computeFingerprint(envKey),
        apiKey: envKey.trim(),
      };
    }

    // 4. Provider-specific public default (free tier).
    //    OpenCode Zen accepte la clé publique `public` SANS configuration :
    //    seul le free tier (modèles à coût d'entrée nul) est alors utilisable.
    if (providerId === "opencode-zen") {
      return {
        providerId,
        source: "public_default",
        sourceLabel: "Zen Public Gateway (Bearer public)",
        isConfigured: true,
        keyLength: 6,
        fingerprint: computeFingerprint("public"),
        apiKey: PUBLIC_GATEWAY_KEY,
      };
    }

    // 5. Unconfigured
    return {
      providerId,
      source: "none",
      sourceLabel: "Non configuré",
      isConfigured: false,
      keyLength: 0,
      fingerprint: "none",
    };
  }

  private getEnvKeyForProvider(providerId: string): string | undefined {
    switch (providerId) {
      case "google":
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      case "openai":
        return process.env.OPENAI_API_KEY;
      case "mistral":
        return process.env.MISTRAL_API_KEY;
      case "openrouter":
        return process.env.OPENROUTER_API_KEY;
      case "deepseek":
        return process.env.DEEPSEEK_API_KEY;
      case "grok":
        return process.env.GROK_API_KEY || process.env.XAI_API_KEY;
      case "opencode-zen":
        return process.env.OPENCODE_API_KEY;
      case "e2b":
        return process.env.E2B_API_KEY;
      case "vercel":
        return process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
      case "github-codespaces":
        return process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
      default:
        return undefined;
    }
  }

  private getEnvVarName(providerId: string): string {
    switch (providerId) {
      case "google":
        return process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : "GOOGLE_API_KEY";
      case "openai":
        return "OPENAI_API_KEY";
      case "mistral":
        return "MISTRAL_API_KEY";
      case "openrouter":
        return "OPENROUTER_API_KEY";
      case "deepseek":
        return "DEEPSEEK_API_KEY";
      case "grok":
        return process.env.GROK_API_KEY ? "GROK_API_KEY" : "XAI_API_KEY";
      case "opencode-zen":
        return "OPENCODE_API_KEY";
      case "e2b":
        return "E2B_API_KEY";
      case "vercel":
        return "VERCEL_TOKEN";
      default:
        return "ENV";
    }
  }

  getProviderStatus(providerId: string, sessionId?: string): ProviderStatus | null {
    const def = PROVIDER_REGISTRY[providerId];
    if (!def) return null;

    const resolved = this.resolveCredentials(providerId, sessionId);
    const test = testsStore.get(providerId);

    return {
      id: def.id,
      name: def.name,
      category: def.category,
      authenticationMethod: def.authenticationMethod,
      description: def.description,
      configured: resolved.isConfigured,
      source: resolved.source,
      sourceLabel: resolved.sourceLabel,
      keyLength: resolved.keyLength,
      fingerprint: resolved.fingerprint,
      maskedKey: resolved.isConfigured && resolved.apiKey ? maskSecret(resolved.apiKey) : undefined,
      lastTestedAt: test?.timestamp,
      lastTestStatus: test ? test.status : "untested",
      lastTestMessage: test?.message,
      httpStatus: test?.httpStatus,
      latencyMs: test?.latencyMs,
    };
  }

  getAllStatuses(sessionId?: string): ProviderStatus[] {
    return Object.keys(PROVIDER_REGISTRY).map((id) => this.getProviderStatus(id, sessionId)!);
  }

  saveCredentials(
    providerId: string,
    fields: Record<string, string>,
    sessionId?: string,
  ): { success: boolean; status: ProviderStatus } {
    const def = PROVIDER_REGISTRY[providerId];
    if (!def) throw new Error(`Provider inconnu: ${providerId}`);

    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === "string" && v.trim()) {
        sanitized[k] = v.trim();
      }
    }

    if (sessionId) {
      if (!sessionCredentialsStore.has(sessionId)) {
        sessionCredentialsStore.set(sessionId, new Map());
      }
      sessionCredentialsStore.get(sessionId)!.set(providerId, sanitized);
    } else {
      credentialsStore.set(providerId, sanitized);
    }

    testsStore.delete(providerId);

    return {
      success: true,
      status: this.getProviderStatus(providerId, sessionId)!,
    };
  }

  deleteCredentials(providerId: string, sessionId?: string): { success: boolean; status: ProviderStatus } {
    if (sessionId) {
      sessionCredentialsStore.get(sessionId)?.delete(providerId);
    } else {
      credentialsStore.delete(providerId);
    }
    testsStore.delete(providerId);

    return {
      success: true,
      status: this.getProviderStatus(providerId, sessionId)!,
    };
  }

  getCredentials(providerId: string, sessionId?: string): Record<string, string> | undefined {
    if (sessionId) {
      const sessionCreds = sessionCredentialsStore.get(sessionId)?.get(providerId);
      if (sessionCreds) return sessionCreds;
    }
    const store = credentialsStore.get(providerId);
    if (store) return store;

    const envKey = this.getEnvKeyForProvider(providerId);
    if (envKey) {
      return { apiKey: envKey };
    }
    return undefined;
  }

  recordTestResult(
    providerId: string,
    status: "success" | "error",
    message: string,
    extra?: { httpStatus?: number; latencyMs?: number },
  ) {
    testsStore.set(providerId, {
      status,
      message,
      timestamp: new Date().toISOString(),
      httpStatus: extra?.httpStatus,
      latencyMs: extra?.latencyMs,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Persistance disque                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Charge les identifiants depuis le disque vers le store mémoire.
   * DOIT être appelé au démarrage d'un process (CLI) : sans ça, les clés
   * sauvegardées ne sont pas visibles.
   * @returns les ids de providers chargés
   */
  async hydrate(cwd: string = process.cwd()): Promise<string[]> {
    const persisted = await readPersistedCredentials(cwd);
    for (const [providerId, fields] of Object.entries(persisted)) {
      credentialsStore.set(providerId, fields);
    }
    return Object.keys(persisted);
  }

  /** Sauvegarde (mémoire + disque) les champs d'un provider. */
  async persist(
    providerId: string,
    fields: Record<string, string>,
    scope: "project" | "global" = "project",
    cwd: string = process.cwd(),
  ): Promise<{ success: boolean; status: ProviderStatus; file: string }> {
    const result = this.saveCredentials(providerId, fields);
    const file = await writePersistedCredentials(providerId, fields, scope, cwd);
    return { ...result, file };
  }

  /** Supprime les identifiants d'un provider (mémoire + disque). */
  async remove(
    providerId: string,
    scope: "project" | "global" = "project",
    cwd: string = process.cwd(),
  ): Promise<{ success: boolean; status: ProviderStatus; removed: boolean }> {
    const result = this.deleteCredentials(providerId);
    const removed = await removePersistedCredentials(providerId, scope, cwd);
    return { ...result, removed };
  }
}

export const credentialManager = new CredentialManager();

setCredentialResolver((providerId, sessionId) => {
  const resolved = credentialManager.resolveCredentials(providerId, sessionId);
  if (!resolved.isConfigured || !resolved.apiKey) {
    return undefined;
  }
  return { apiKey: resolved.apiKey, source: resolved.source };
});
