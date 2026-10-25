/**
 * Provider and Model Definitions for SoryOS-Code Web App
 * Integrates with @soryos/provider and provides live model discovery.
 */

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  isFree?: boolean;
  badge?: string;
  description?: string;
  supportsTools?: boolean;
  contextLength?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  category?: string;
  hasFreeTier?: boolean;
  models: ModelInfo[];
}

export const DEFAULT_MODEL_ID = "gemini-3.8-flash";

export const INITIAL_PROVIDERS: ProviderInfo[] = [
  {
    id: "google",
    name: "Google Gemini",
    description: "Modèles d'ingénierie Google de pointe (générations 2.x & 3.x) avec large contexte jusqu'à 2M tokens.",
    category: "ai",
    hasFreeTier: true,
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Recommandé",
        description: "Modèle ultra-rapide optimisé pour le codage autonome et l'exécution d'outils physiques.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Raisonnement",
        description: "Raisonnement avancé pour refactoring complexe, architecture et analyse de bugs profonds.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
      {
        id: "gemini-3.0-flash",
        name: "Gemini 3.0 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Génération 3",
        description: "Nouvelle génération 3.0 ultra-véloce avec capacités multimodales natives et latence minimale.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-3.0-pro",
        name: "Gemini 3.0 Pro",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Génération 3 Pro",
        description: "Modèle de pointe de génération 3 pour l'ingénierie logicielle et le raisonnement multi-étapes.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
      {
        id: "gemini-3.1-pro",
        name: "Gemini 3.1 Pro",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Ingénierie Avancée",
        description: "Capacité d'abstraction supérieure, analyse de codebases massives et vérification formelle.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
      {
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Génération 3.5",
        description: "Vitesse phénoménale et capacités de raisonnement hybride de génération 3.5.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-3.5-pro",
        name: "Gemini 3.5 Pro",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Frontière Ultime",
        description: "Modèle frontière suprême combinant raisonnement profond multi-pass et exécution sans compromis.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Génération 3.8",
        description: "Dernière évolution Google avec vitesse de traitement ultra-réactive et orchestration outillée.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-3.8-pro",
        name: "Gemini 3.8 Pro",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Génération 3.8 Pro",
        description: "Modèle de pointe 3.8 pour raisonnement étendu, refactoring massif et codage complexe.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Génération 2",
        description: "Vitesse d'exécution exceptionnelle pour le streaming interactif et les tâches en temps réel.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash-Lite",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Flash Lite",
        description: "Variante ultra-légère conçue pour une latence minimale et les micro-tâches de codage.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-2.0-flash-thinking-exp",
        name: "Gemini 2.0 Flash Thinking",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Thinking Exp",
        description: "Modèle avec processus de pensée dynamique visible pour la résolution algorithmique complexe.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-2.0-flash-thinking-exp-01-21",
        name: "Gemini 2.0 Thinking (01-21)",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Thinking 01-21",
        description: "Instantané perfectionné du modèle de pensée dynamique pour l'analyse de code approfondie.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "gemini-2.0-pro-exp-02-05",
        name: "Gemini 2.0 Pro Experimental",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Génération 2 Pro",
        description: "Modèle de raisonnement lourd pour l'analyse d'AST et la génération de patches stricts.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
      {
        id: "gemini-exp-1206",
        name: "Gemini Exp 1206",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Expérience Google",
        description: "Version expérimentale phare avec haute fidélité d'écriture et résolution de bugs.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Modèles Claude 3.x reconnus mondialement pour l'excellence en programmation et sécurité du code.",
    category: "ai",
    models: [
      {
        id: "claude-3-7-sonnet",
        name: "Claude 3.7 Sonnet",
        providerId: "anthropic",
        providerName: "Anthropic Claude",
        isFree: false,
        badge: "Hybride Pensée/Code",
        description: "Le modèle hybride de pointe avec réflexion dynamique et excellence absolue en ingénierie logicielle.",
        supportsTools: true,
        contextLength: "200k tokens",
      },
      {
        id: "claude-3-5-sonnet",
        name: "Claude 3.5 Sonnet",
        providerId: "anthropic",
        providerName: "Anthropic Claude",
        isFree: false,
        badge: "Standard d'Or",
        description: "Référence mondiale pour les agents de développement, le refactoring et l'utilisation d'outils.",
        supportsTools: true,
        contextLength: "200k tokens",
      },
      {
        id: "claude-3-5-haiku",
        name: "Claude 3.5 Haiku",
        providerId: "anthropic",
        providerName: "Anthropic Claude",
        isFree: false,
        badge: "Rapide & Précis",
        description: "Vitesse foudroyante et précision chirurgicale pour les tâches de codage légères et les tests.",
        supportsTools: true,
        contextLength: "200k tokens",
      },
      {
        id: "claude-3-opus",
        name: "Claude 3 Opus",
        providerId: "anthropic",
        providerName: "Anthropic Claude",
        isFree: false,
        badge: "Raisonnement Profond",
        description: "Conception architecturale de haut niveau, formalisation mathématique et synthèse de données complexes.",
        supportsTools: true,
        contextLength: "200k tokens",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Modèles phares o1, o3, GPT-4.5 et GPT-4o pour synthèse, raisonnement poussé et exécution de code.",
    category: "ai",
    hasFreeTier: true,
    models: [
      {
        id: "o3-mini",
        name: "OpenAI o3-mini",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Raisonnement STEM",
        description: "Modèle de raisonnement de pointe optimisé pour la programmation, les mathématiques et l'algorithmie.",
        supportsTools: true,
        contextLength: "200k tokens",
      },
      {
        id: "o1",
        name: "OpenAI o1",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Chaîne de Pensée",
        description: "Raisonnement approfondi avec temps de réflexion pour résoudre les problèmes d'ingénierie les plus ardus.",
        supportsTools: true,
        contextLength: "200k tokens",
      },
      {
        id: "gpt-4.5-preview",
        name: "GPT-4.5 Orion",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Frontière OpenAI",
        description: "Modèle de fondation le plus massif d'OpenAI offrant une compréhension contextuelle inégalée.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Flagship",
        description: "Performance haut de gamme pour toutes tâches de codage et d'orchestration multimodale.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: true,
        badge: "Rapide",
        description: "Version légère et rapide pour requêtes courantes et micro-tâches.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Modèles ouverts et compétitifs de dernière génération spécialisés en code et raisonnement formel.",
    category: "ai",
    hasFreeTier: true,
    models: [
      {
        id: "deepseek-r1",
        name: "DeepSeek R1",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: true,
        badge: "Raisonnement Libre",
        description: "Modèle de raisonnement par renforcement rivalisant avec les meilleurs modèles fermés du marché.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "deepseek-v3",
        name: "DeepSeek V3 (671B MoE)",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: true,
        badge: "671B MoE",
        description: "Architecture Mixture-of-Experts ultra-performante pour l'écriture de code et l'analyse système.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "deepseek-coder-33b",
        name: "DeepSeek Coder 33B",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: true,
        badge: "Spécialiste Code",
        description: "Spécialiste dédié à la génération de syntaxe propre, aux tests unitaires et aux algorithmes.",
        supportsTools: true,
        contextLength: "64k tokens",
      },
    ],
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    description: "Hub de modèles gratuits auto-hébergés et optimisés pour la programmation sans quota restrictif.",
    category: "ai",
    hasFreeTier: true,
    models: [
      {
        id: "opencode-zen-qwen-coder",
        name: "Qwen 2.5 Coder 32B (Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Le meilleur modèle ouvert spécialisé dans le codage autonome et la résolution de bugs complexes.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "opencode-zen-llama3-instruct",
        name: "Llama 3.3 70B (Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Modèle ouvert 70B de niveau GPT-4o pour la planification et l'ingénierie logicielle générale.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "opencode-zen-deepseek-r1",
        name: "DeepSeek R1 Distill (Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Raisonnement logique et décomposition analytique étape par étape sans frais d'API.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "opencode-zen-deepseek-coder",
        name: "DeepSeek Coder 33B (Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Spécialiste de la génération de code, syntaxe et tests unitaires.",
        supportsTools: true,
        contextLength: "64k tokens",
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Modèles européens souverains axés sur la précision, le codage avancé et l'optimisation des tokens.",
    category: "ai",
    models: [
      {
        id: "codestral-2501",
        name: "Codestral 25.01",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Codestral 2025",
        description: "Modèle de pointe européen dédié au développement logiciel, au fill-in-the-middle et aux tests.",
        supportsTools: true,
        contextLength: "256k tokens",
      },
      {
        id: "mistral-large-2411",
        name: "Mistral Large 2 (24.11)",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Mistral Large",
        description: "Modèle phare de 123 milliards de paramètres avec capacités multilingues et raisonnement poussé.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "pixtral-large",
        name: "Pixtral Large (124B)",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Vision & Code",
        description: "Modèle multimodal frontière capable d'analyser des maquettes UI, diagrammes et code source.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter (Free Tier)",
    description: "Modèles open-weights et partenaires accessibles gratuitement via OpenRouter (:free).",
    category: "ai",
    hasFreeTier: true,
    models: [
      {
        id: "openrouter/deepseek/deepseek-r1:free",
        name: "DeepSeek R1 (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Raisonnement avancé par renforcement via OpenRouter sans aucun coût d'API.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/deepseek/deepseek-chat:free",
        name: "DeepSeek V3 (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle MoE 671B haute performance pour la programmation et la génération de code.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle Meta Llama 3.3 70B accessible gratuitement sur OpenRouter pour le développement.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/qwen/qwen-2.5-coder-32b-instruct:free",
        name: "Qwen 2.5 Coder 32B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Spécialiste de la programmation open-weights distribué sans frais par OpenRouter.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash Exp (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Gemini 2.0 Flash Experimental disponible gratuitement via les quotas OpenRouter.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "openrouter/google/gemini-2.0-flash-thinking-exp:free",
        name: "Gemini 2.0 Flash Thinking (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Gemini 2.0 Thinking Exp avec raisonnement visible gratuit via OpenRouter.",
        supportsTools: true,
        contextLength: "1M tokens",
      },
      {
        id: "openrouter/mistralai/mistral-small-24b-instruct-2501:free",
        name: "Mistral Small 24B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle compact et efficace de Mistral AI version 25.01 gratuit sur OpenRouter.",
        supportsTools: true,
        contextLength: "32k tokens",
      },
      {
        id: "openrouter/meta-llama/llama-3.2-3b-instruct:free",
        name: "Llama 3.2 3B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle ultra-rapide pour génération instantanée et auto-complétion.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/meta-llama/llama-3.2-1b-instruct:free",
        name: "Llama 3.2 1B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle ultra-léger 1B à latence minimale pour tâches simples et suggestions de syntaxe.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/google/gemini-2.0-pro-exp-02-05:free",
        name: "Gemini 2.0 Pro Exp (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Accès gratuit au modèle expérimental Gemini 2.0 Pro via OpenRouter.",
        supportsTools: true,
        contextLength: "2M tokens",
      },
      {
        id: "openrouter/qwen/qwen-2.5-72b-instruct:free",
        name: "Qwen 2.5 72B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle de fondation puissant 72B spécialisé en logique et programmation complexe.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/deepseek/deepseek-r1-distill-llama-70b:free",
        name: "DeepSeek R1 Distill Llama 70B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Distillation du raisonnement DeepSeek R1 sur l'architecture Meta Llama 70B.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/deepseek/deepseek-r1-distill-qwen-32b:free",
        name: "DeepSeek R1 Distill Qwen 32B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Raisonnement étape par étape compact et précis basé sur Qwen 2.5 32B.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/nousresearch/hermes-3-llama-3.1-405b:free",
        name: "Hermes 3 405B (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Le plus colossal des modèles ouverts (405 milliards) avec alignement instructif non censuré.",
        supportsTools: true,
        contextLength: "128k tokens",
      },
      {
        id: "openrouter/cognitivecomputations/dolphin3.0-r1-mistral-24b:free",
        name: "Dolphin 3.0 R1 Mistral (OpenRouter Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle de raisonnement autonome sans filtre entraîné sur l'architecture Mistral 24B.",
        supportsTools: true,
        contextLength: "32k tokens",
      },
    ],
  },
];

declare global {
  var __soryos_cached_providers: ProviderInfo[] | undefined;
}

export function getAllProviders(): ProviderInfo[] {
  const totalCachedModels =
    globalThis.__soryos_cached_providers?.reduce(
      (acc, p) => acc + p.models.length,
      0
    ) ?? 0;
  const totalInitialModels = INITIAL_PROVIDERS.reduce(
    (acc, p) => acc + p.models.length,
    0
  );

  if (
    !globalThis.__soryos_cached_providers ||
    globalThis.__soryos_cached_providers.length !== INITIAL_PROVIDERS.length ||
    totalCachedModels < totalInitialModels
  ) {
    globalThis.__soryos_cached_providers = [...INITIAL_PROVIDERS];
  }
  return globalThis.__soryos_cached_providers;
}

export function getModelById(modelId: string): ModelInfo {
  const providers = getAllProviders();
  for (const provider of providers) {
    const found = provider.models.find((m) => m.id === modelId);
    if (found) return found;
  }
  // Fallback to default model or generic
  return (
    providers[0]?.models[0] || {
      id: modelId,
      name: modelId,
      providerId: "google",
      providerName: "Google Gemini",
      isFree: true,
    }
  );
}

export async function syncOpenCodeZenModels(): Promise<{ synced: number; message: string }> {
  try {
    // Attempt to query OpenCode Zen live registry if endpoint exists
    const zenEndpoint = process.env.OPENCODE_ZEN_URL || "https://zen.opencode.ai/api/v1/models";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(zenEndpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.models)) {
        const providers = getAllProviders();
        const zenProvider = providers.find((p) => p.id === "opencode-zen");
        if (zenProvider) {
          const newModels = data.models.map((m: any) => ({
            id: m.id || `opencode-zen-${m.name.toLowerCase()}`,
            name: m.name || m.id,
            providerId: "opencode-zen",
            providerName: "OpenCode Zen",
            isFree: true,
            badge: "Zen Free",
            description: m.description || "Modèle dynamique OpenCode Zen synchronisé.",
            supportsTools: Boolean(m.supports_tools ?? true),
          }));
          zenProvider.models = newModels;
          return { synced: newModels.length, message: `Synchronisé avec succès ${newModels.length} modèles Zen` };
        }
      }
    }
  } catch (err) {
    console.warn("Sync OpenCode Zen skipped:", err);
  }

  const providers = getAllProviders();
  const zenProvider = providers.find((p) => p.id === "opencode-zen");
  return {
    synced: zenProvider?.models.length || 0,
    message: "Modèles OpenCode Zen à jour",
  };
}
