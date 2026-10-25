/**
 * Auth — résolution du provider IA et de sa clé.
 *
 * Ordre de résolution :
 *   1. provider ACTIF (`soryos-code auth switch <provider>`)
 *   2. providers enregistrés sur disque
 *   3. variables d'environnement
 *
 * Si un provider actif est défini mais SANS clé, on ne bascule PAS en
 * silence sur un autre provider : c'est une erreur honnête (le provider
 * choisi par l'utilisateur doit être celui qui est utilisé).
 */

import { credentialManager, PROVIDER_REGISTRY, isPublicGatewayKey } from "@soryos/credentials";
import { aiProviderRegistry } from "@soryos/provider";
import { getActiveProvider } from "./provider-state";

export interface DetectedCredentials {
  provider: string;
  providerId: string;
  apiKey: string;
  source: string;
}

/** Contexte provider complet (clé + modèle par défaut). */
export interface ProviderContext {
  /** Id du provider retenu. */
  providerId: string;
  /** Nom lisible. */
  providerName: string;
  /** Clé d'API (null si le provider n'est pas configuré). */
  apiKey: string | null;
  /** Origine de la clé (env, store…). */
  source: string;
  /** Modèle par défaut du provider. */
  defaultModel: string;
  /** Un provider actif a été choisi mais il n'a pas de clé. */
  activeWithoutKey: boolean;
}

const PROVIDER_ORDER = [
  "google",
  "openai",
  "anthropic",
  "mistral",
  "openrouter",
  "deepseek",
  "grok",
  "opencode-zen",
];

const ENV_VARS: Record<string, string[]> = {
  google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  grok: ["GROK_API_KEY", "XAI_API_KEY"],
  "opencode-zen": ["OPENCODE_API_KEY"],
};

/** Charge les identifiants du disque dans le store mémoire (une fois au démarrage). */
export async function hydrateCredentials(cwd: string = process.cwd()): Promise<string[]> {
  try {
    return await credentialManager.hydrate(cwd);
  } catch {
    return [];
  }
}

/** Env var défini pour un provider (nom de la variable). */
export function envVarName(providerId: string): string | undefined {
  return ENV_VARS[providerId]?.find((v) => Boolean(process.env[v]));
}

/** Modèle par défaut d'un provider (registre réel). */
export function defaultModelFor(providerId: string): string {
  try {
    return aiProviderRegistry.getRequiredProvider(providerId).getDefaultModel();
  } catch {
    return "gemini-2.5-flash";
  }
}

/** Le provider appartient-il à un modèle donné ? (évite les couples impossibles) */
export function providerOwnsModel(providerId: string, modelId: string): boolean {
  try {
    const provider = aiProviderRegistry.getRequiredProvider(providerId);
    return provider.listModels().some((m) => m.id === modelId);
  } catch {
    return false;
  }
}

/**
 * Un modèle est-il utilisable avec la clé courante ?
 * - clé publique du gateway → uniquement le free tier (coût d'entrée nul)
 * - clé personnelle → tous les modèles du provider
 */
export function isModelUsable(
  providerId: string,
  modelId: string,
  apiKey: string | null | undefined,
): boolean {
  if (providerId !== "opencode-zen") return true;
  if (!isPublicGatewayKey(apiKey)) return true;
  // Free tier : le modèle doit être gratuit.
  try {
    const provider = aiProviderRegistry.getRequiredProvider(providerId);
    const model = provider.listModels().find((m) => m.id === modelId);
    if (!model) return false;
    return model.isFree === true;
  } catch {
    return false;
  }
}

/**
 * Le modèle nécessite-t-il une clé que l'utilisateur n'a pas ?
 * - OpenCode Zen en clé publique → les modèles payants du free tier
 * - autre provider → il faut sa propre clé configurée
 */
export function modelNeedsKey(
  providerId: string,
  modelId: string,
  activeApiKey: string | null | undefined,
): boolean {
  if (providerId === "opencode-zen") {
    return !isModelUsable(providerId, modelId, activeApiKey);
  }
  const resolved = credentialManager.resolveCredentials(providerId);
  if (!resolved.isConfigured) return true;
  // Si le provider du modèle EST le provider actif, on dispose de sa clé.
  return false;
}

/**
 * Rafraîchit le catalogue du provider Zen depuis la passerelle (liste en
 * direct). Sans réseau ou en cas d'échec, le catalogue statique reste used.
 * @returns le nombre de modèles servis, ou null si l'appel a échoué
 */
export async function refreshLiveModels(): Promise<number | null> {
  try {
    const provider = aiProviderRegistry.getRequiredProvider("opencode-zen") as {
      refreshModels?: () => Promise<number | null>;
    };
    if (typeof provider.refreshModels !== "function") return null;
    return await provider.refreshModels();
  } catch {
    return null;
  }
}

/**
 * Résout le provider à utiliser et sa clé.
 * @param options.cwd répertoire de lecture du provider actif
 * @returns le contexte provider (clé null si non configuré)
 */
export async function resolveProviderContext(options?: { cwd?: string }): Promise<ProviderContext> {
  const active = await getActiveProvider(options?.cwd);

  const contextFor = (providerId: string): ProviderContext => {
    const status = credentialManager.getProviderStatus(providerId);
    const resolved = credentialManager.resolveCredentials(providerId);
    const configured = Boolean(status?.configured && resolved.apiKey);
    return {
      providerId,
      providerName: status?.name ?? PROVIDER_REGISTRY[providerId]?.name ?? providerId,
      apiKey: configured ? resolved.apiKey! : null,
      source: status?.sourceLabel ?? "not configured",
      defaultModel: defaultModelFor(providerId),
      activeWithoutKey: false,
    };
  };

  // 1. Provider actif : il fait autorité (même sans clé → erreur honnête).
  if (active) {
    const context = contextFor(active);
    if (context.apiKey) return context;
    return { ...context, activeWithoutKey: true };
  }

  // 2. Premier provider configuré (disque ou env).
  for (const providerId of PROVIDER_ORDER) {
    const context = contextFor(providerId);
    if (context.apiKey) return context;
  }

  // 3. Aucun provider configuré : on retourne le premier connu (clé absente).
  return contextFor(PROVIDER_ORDER[0]);
}

/**
 * Première clé d'API utilisable.
 * @returns null si aucun provider n'est configuré OU si le provider actif n'a pas de clé
 */
export async function detectProviderAndKey(): Promise<DetectedCredentials | null> {
  const context = await resolveProviderContext();
  if (!context.apiKey) return null;
  return {
    provider: context.providerName,
    providerId: context.providerId,
    apiKey: context.apiKey,
    source: context.source,
  };
}

/** Liste des providers IA déclarés (pour les pickers). */
export function aiProviderIds(): string[] {
  return Object.keys(PROVIDER_REGISTRY).filter((id) => PROVIDER_REGISTRY[id].category === "ai");
}
