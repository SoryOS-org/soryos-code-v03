/**
 * OpenCode Agents Definitions for SoryOS-Code
 * Defines the specialized agent matrix according to AGENTS.md rules.
 */

export interface OpenCodeAgent {
  id: string;
  name: string;
  role: string;
  badge: string;
  color: string;
  icon: string;
  description: string;
  capabilities: string[];
  tools: string[];
  whenToUse: string;
}

export const OPENCODE_AGENTS: OpenCodeAgent[] = [
  {
    id: "build",
    name: "Build Agent",
    role: "Ingénierie & Implémentation complète",
    badge: "Par défaut",
    color: "#2563eb",
    icon: "⚡",
    description: "Agent autonome principal doté des permissions complètes d'écriture, d'exécution shell et de refactoring de fichiers physiques.",
    capabilities: [
      "Création et modification de fichiers sur le disque réel",
      "Exécution de commandes shell et tests de build",
      "Installation et synchronisation des dépendances",
      "Vérification d'intégrité TypeScript et linting",
    ],
    tools: ["read_file", "write_file", "edit_file", "shell_command", "git_status"],
    whenToUse: "À utiliser pour toute tâche d'implémentation, résolution de bugs, création de fonctionnalités ou exécution de scripts.",
  },
  {
    id: "plan",
    name: "Plan Agent",
    role: "Architecture & Stratégie logicielle",
    badge: "Lecture seule",
    color: "#8b5cf6",
    icon: "🗺️",
    description: "Concepteur système spécialisé dans l'élaboration de feuilles de route détaillées sans altération directe des fichiers.",
    capabilities: [
      "Analyse structurelle approfondie des dépendances",
      "Définition de plans d'intégration pas à pas",
      "Évaluation des risques de régression",
      "Spécification des interfaces et contrats d'API",
    ],
    tools: ["read_file", "list_dir", "grep_search", "find_files"],
    whenToUse: "À utiliser avant un refactoring majeur ou pour planifier une nouvelle fonctionnalité complexe.",
  },
  {
    id: "explore",
    name: "Explore Agent",
    role: "Découverte & Navigation de codebase",
    badge: "Investigation",
    color: "#06b6d4",
    icon: "🔍",
    description: "Explorateur rapide dédié à la cartographie du dépôt, à la recherche de symboles et à la compréhension de l'arborescence.",
    capabilities: [
      "Indexation ultra-rapide des chemins et modules",
      "Recherche sémantique et textuelle de symboles",
      "Localisation des points d'entrée et flux de données",
      "Génération de résumés de structure",
    ],
    tools: ["read_file", "list_dir", "grep_search", "find_files"],
    whenToUse: "À utiliser pour appréhender un dépôt inconnu ou localiser rapidement des fichiers cibles.",
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    role: "Audit Qualité & Sécurité",
    badge: "Contrôle",
    color: "#10b981",
    icon: "🛡️",
    description: "Auditeur méticuleux examinant la sécurité, la conformité aux conventions, les performances et la dette technique.",
    capabilities: [
      "Détection des failles OWASP et fuites de secrets",
      "Vérification de la typification stricte TypeScript",
      "Analyse de complexité cyclomatique et lisibilité",
      "Validation du respect des frontières de paquets monorepo",
    ],
    tools: ["read_file", "git_diff", "grep_search"],
    whenToUse: "À utiliser avant de commiter ou pour valider la robustesse d'un ensemble de changements.",
  },
  {
    id: "debugger",
    name: "Debugger Agent",
    role: "Analyse causale & Résolution d'erreurs",
    badge: "Diagnostic",
    color: "#ef4444",
    icon: "🐞",
    description: "Spécialiste de l'investigation des logs d'erreurs, des stack traces et de la reproduction de comportements anormaux.",
    capabilities: [
      "Isolation des stack traces et exceptions non gérées",
      "Diagnostic pas à pas des échecs de compilation",
      "Vérification des variables d'environnement manquantes",
      "Proposition de correctifs chirurgicaux minimaux",
    ],
    tools: ["read_file", "shell_command", "edit_file"],
    whenToUse: "À utiliser en cas de crash, d'erreur 500 ou d'échec de compilation bloquant.",
  },
  {
    id: "orchestrator",
    name: "Orchestrator Agent",
    role: "Coordination multi-agents & Flux complexes",
    badge: "Coordination",
    color: "#f59e0b",
    icon: "👑",
    description: "Superviseur capable de décomposer une mission en sous-tâches et de coordonner les agents spécialisés.",
    capabilities: [
      "Décomposition modulaire de requêtes complexes",
      "Supervision du pipeline bout-en-bout",
      "Arbitrage entre planification et exécution",
      "Agrégation des résultats pour l'utilisateur final",
    ],
    tools: ["read_file", "shell_command", "write_file", "edit_file"],
    whenToUse: "À utiliser pour les missions transverses nécessitant exploration, planification, exécution et vérification.",
  },
];

export function getAgentById(agentId: string): OpenCodeAgent {
  const found = OPENCODE_AGENTS.find((a) => a.id === agentId);
  return found || OPENCODE_AGENTS[0];
}
