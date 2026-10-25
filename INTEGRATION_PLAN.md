# Plan d'Intégration Vibra Code → SoryOS-Cloud

## Objectif
Extraire les logiques techniques pertinentes de Vibra Code et les intégrer dans SoryOS-Cloud pour rendre l'IA beaucoup plus capable, autonome et fiable.

## Analyse Préliminaire

### Vibra Code - Points Forts

1. **Agent Loop Sophistiqué**
   - Exécution streaming avec parsing JSON intelligent
   - Gestion des chunks partiels et buffers
   - Traitement multi-format (Claude Code, Cursor Agent)
   - Gestion des messages delta (streaming)

2. **Tool System Avancé**
   - Outils intégrés : read, write, edit, bash, grep, glob, etc.
   - Vérification réelle des opérations (NO REAL EXECUTION = NO SUCCESS)
   - Gestion des erreurs par outil
   - Métadonnées riches (exit codes, durations, etc.)

3. **E2B Sandbox Management**
   - Création et connexion de sandboxes
   - Auto-pause native
   - Gestion des timeouts
   - Exécution de commandes dans sandbox

4. **Error Recovery**
   - Détection des timeouts
   - Gestion des sandboxes terminées
   - Messages utilisateur clairs
   - Récupération automatique possible

5. **Context Management**
   - Gestion des sessions
   - Historique des messages
   - Injection de fichiers (images, audio, vidéo)
   - Système de prompts dynamiques

6. **Multi-Agent Support**
   - Claude Code
   - Cursor Agent
   - Gemini
   - Configuration MCP (Model Context Protocol)

7. **Git/GitHub Integration**
   - Initialisation git
   - Commit et push automatisés
   - Gestion des repositories

8. **Dev Runner**
   - Détection du projet
   - Installation des dépendances
   - Build et execution
   - Détection des ports
   - Health checks

### SoryOS-Cloud - État Actuel

1. **Agent Runtime** ✅ (Bon mais peut être amélioré)
   - Multi-turn conversation
   - Streaming support
   - Tool execution
   - Session management
   - Event bus

2. **Tool System** ✅ (Bon mais incomplet)
   - Tool Registry
   - Tool Executor
   - Vérification physique
   - Permission system
   - Filesystem tools
   - Shell tools

3. **Execution Providers** ✅ (Bon)
   - Abstraction pour différents environnements
   - Local, E2B, Vercel, Codespaces, Cloud Run

4. **Error Handling** ⚠️ (À améliorer)
   - Classification basique
   - Pas de récupération automatique

5. **Context Builder** ⚠️ (À améliorer)
   - Sélection de contexte intelligente manquante
   - Pas de gestion progressive

6. **Planning System** ❌ (Manquant)
   - Pas de planification multi-étapes
   - Pas de subagents

7. **Long-running Tasks** ⚠️ (Partiel)
   - Sessions existantes
   - Pas de background agents

## Matrice de Comparaison

| Fonctionnalité | Vibra Code | SoryOS-Cloud | État | Action |
|--------------|------------|--------------|------|--------|
| Agent Loop | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Tool Registry | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | SoryOS bon | CONSERVER |
| Tool Execution | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Filesystem Tools | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Terminal/Process | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Codebase Intelligence | ⭐⭐⭐⭐ | ⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Context Builder | ⭐⭐⭐⭐ | ⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Error Recovery | ⭐⭐⭐⭐⭐ | ⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Planning System | ⭐⭐⭐⭐ | ❌ | Vibra Code meilleur | **INTÉGRER** |
| Subagents | ⭐⭐⭐ | ❌ | Vibra Code meilleur | **INTÉGRER** |
| Long-running Tasks | ⭐⭐⭐⭐ | ⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Background Execution | ⭐⭐⭐⭐ | ❌ | Vibra Code meilleur | **INTÉGRER** |
| Dev Runner | ⭐⭐⭐⭐⭐ | ⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Preview System | ⭐⭐⭐⭐ | ⭐⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| Git/GitHub | ⭐⭐⭐⭐⭐ | ⭐⭐ | Vibra Code meilleur | **INTÉGRER** |
| MCP Integration | ⭐⭐⭐⭐ | ❌ | Vibra Code meilleur | **INTÉGRER** |

## Priorités d'Intégration

### PRIORITÉ 1: Agent Runtime Amélioré
- [ ] Extraire la logique de streaming de Vibra Code
- [ ] Intégrer le parsing JSON intelligent avec buffer
- [ ] Ajouter le support multi-format (Claude, Cursor, Gemini)
- [ ] Améliorer la gestion des messages delta
- [ ] Ajouter le support MCP

### PRIORITÉ 2: Tool System Complet
- [ ] Extraire tous les outils de Vibra Code
- [ ] Ajouter les outils manquants (grep, glob, semantic search)
- [ ] Améliorer la vérification physique
- [ ] Ajouter les métadonnées riches (exit codes, durations)
- [ ] Intégrer avec Execution Providers existants

### PRIORITÉ 3: Error Recovery Avancé
- [ ] Extraire la logique de récupération de Vibra Code
- [ ] Ajouter la détection des timeouts
- [ ] Gestion des sandboxes terminées
- [ ] Récupération automatique pour erreurs connues
- [ ] Messages utilisateur clairs

### PRIORITÉ 4: Context Builder Intelligent
- [ ] Extraire la logique de sélection de contexte
- [ ] Ajouter la gestion progressive du contexte
- [ ] Intégrer avec Session/Workspace/Project
- [ ] Optimiser l'envoi au modèle

### PRIORITÉ 5: Planning System
- [ ] Extraire la logique de planification
- [ ] Ajouter les subagents (Planner, Coder, Tester, Reviewer, Debugger)
- [ ] Intégrer avec Agent Runtime
- [ ] Gestion des tâches multi-étapes

### PRIORITÉ 6: Dev Runner
- [ ] Extraire la logique de détection de projet
- [ ] Ajouter l'installation automatique des dépendances
- [ ] Intégrer build et execution
- [ ] Détection des ports et health checks
- [ ] Preview system

### PRIORITÉ 7: Git/GitHub Workflows
- [ ] Extraire la logique d'initialisation git
- [ ] Ajouter commit et push automatisés
- [ ] Gestion des repositories
- [ ] Intégration avec sessions

### PRIORITÉ 8: Long-running Tasks & Background Execution
- [ ] Extraire la logique de tâches longues
- [ ] Ajouter le support background agents
- [ ] Gestion des états (queued, running, paused, failed, completed)
- [ ] Persistance des tâches

## Architecture Cible

```
USER
  ↓
SESSION (SoryOS-Cloud)
  ↓
CONTEXT BUILDER (Amélioré de Vibra Code)
  ↓
AGENT PLANNER (Nouveau - de Vibra Code)
  ↓
AI PROVIDER (SoryOS-Cloud existant)
  ↓
MODEL (Claude/Cursor/Gemini)
  ↓
TOOL CALL (Tool Registry amélioré)
  ↓
PERMISSION CHECK (SoryOS-Cloud existant)
  ↓
RUST ENGINE (SoryOS-Cloud existant)
  ↓
EXECUTION PROVIDER (SoryOS-Cloud existant)
  ↓
REAL EXECUTION (Local/E2B/Vercel/Cloud Run)
  ↓
TOOL RESULT (Avec vérification physique)
  ↓
VERIFICATION (Nouveau - de Vibra Code)
  ↓
CONTEXT UPDATE (Amélioré)
  ↓
AGENT DECISION (Amélioré - de Vibra Code)
  ↓
NEXT TOOL (Boucle continue)
  ↓
...
  ↓
FINAL VERIFICATION
  ↓
FINAL RESPONSE
```

## Implémentation

### Étape 1: Créer les fichiers de base améliorés
- [ ] `packages/agent/src/runtime-enhanced.ts` - Agent Runtime avec streaming amélioré
- [ ] `packages/agent/src/streaming-parser.ts` - Parseur JSON streaming
- [ ] `packages/agent/src/tool-registry-enhanced.ts` - Tool Registry complet
- [ ] `packages/agent/src/error-recovery-enhanced.ts` - Error Recovery avancé

### Étape 2: Intégrer les outils de Vibra Code
- [ ] `packages/tool/src/filesystem-tools.ts` - Outils filesystem complets
- [ ] `packages/tool/src/shell-tools.ts` - Outils shell avancés
- [ ] `packages/tool/src/codebase-tools.ts` - Outils codebase intelligence
- [ ] `packages/tool/src/git-tools.ts` - Outils Git/GitHub

### Étape 3: Créer le Context Builder
- [ ] `packages/agent/src/context-builder.ts` - Context Builder intelligent
- [ ] `packages/agent/src/context-selector.ts` - Sélection intelligente du contexte

### Étape 4: Créer le Planning System
- [ ] `packages/agent/src/planner.ts` - Planificateur de tâches
- [ ] `packages/agent/src/subagents.ts` - Subagents spécialisés

### Étape 5: Créer le Dev Runner
- [ ] `packages/dev-runner/src/index.ts` - Dev Runner complet
- [ ] `packages/dev-runner/src/project-detector.ts` - Détection de projet
- [ ] `packages/dev-runner/src/dependency-manager.ts` - Gestion des dépendances
- [ ] `packages/dev-runner/src/port-detector.ts` - Détection des ports

### Étape 6: Intégrer avec Rust Engine
- [ ] Mettre à jour le Rust Engine pour supporter les nouvelles fonctionnalités
- [ ] Ajouter les bindings nécessaires
- [ ] Optimiser les performances

### Étape 7: Tests et Validation
- [ ] Tests unitaires pour chaque composant
- [ ] Tests d'intégration
- [ ] Tests end-to-end
- [ ] Validation des 10 tests de l'utilisateur

## Fichiers à Créer/Modifier

### Nouveaux Fichiers
1. `packages/agent/src/runtime-enhanced.ts`
2. `packages/agent/src/streaming-parser.ts`
3. `packages/agent/src/tool-registry-enhanced.ts`
4. `packages/agent/src/error-recovery-enhanced.ts`
5. `packages/agent/src/context-builder.ts`
6. `packages/agent/src/context-selector.ts`
7. `packages/agent/src/planner.ts`
8. `packages/agent/src/subagents.ts`
9. `packages/tool/src/filesystem-tools.ts`
10. `packages/tool/src/shell-tools.ts`
11. `packages/tool/src/codebase-tools.ts`
12. `packages/tool/src/git-tools.ts`
13. `packages/dev-runner/src/index.ts`
14. `packages/dev-runner/src/project-detector.ts`
15. `packages/dev-runner/src/dependency-manager.ts`
16. `packages/dev-runner/src/port-detector.ts`

### Fichiers à Modifier
1. `packages/agent/src/runtime.ts` - Intégrer les améliorations
2. `packages/tool/src/index.ts` - Ajouter les nouveaux outils
3. `packages/execution/src/index.ts` - Supporter les nouvelles fonctionnalités
4. `packages/session/src/index.ts` - Gestion des tâches longues

## Validation Finale

### Test 1: "Salut"
- ✅ Aucune Tool inutile
- ✅ Réponse simple et rapide

### Test 2: "Liste les fichiers du projet"
- ✅ Vrai filesystem
- ✅ Résultat formaté

### Test 3: "Lis package.json"
- ✅ Vrai fichier lu
- ✅ Contenu affiché avec numéros de ligne

### Test 4: "Crée un fichier test"
- ✅ Vrai fichier créé
- ✅ Vérification physique
- ✅ Confirmation avec métadonnées

### Test 5: "Installe les dépendances"
- ✅ Vrai package manager
- ✅ Exécution réelle
- ✅ Capture stdout/stderr/exit code

### Test 6: "Lance les tests"
- ✅ Vraie exécution
- ✅ Résultats capturés
- ✅ Métadonnées complètes

### Test 7: "Corrige cette erreur"
- ✅ Inspect → modify → test → verify
- ✅ Récupération automatique si erreur

### Test 8: "Crée une petite application"
- ✅ Génération réelle
- ✅ Installation
- ✅ Build
- ✅ Serveur
- ✅ Preview

### Test 9: Erreur volontaire
- ✅ L'agent comprend l'erreur
- ✅ Tentative de récupération
- ✅ Message utilisateur clair

### Test 10: Tâche multi-fichiers
- ✅ Plan → plusieurs Tools → vérification finale
- ✅ Gestion progressive
- ✅ Résultats consolidés

## Suivi

- [ ] Phase 1: Agent Runtime (Priorité 1)
- [ ] Phase 2: Tool System (Priorité 2-4)
- [ ] Phase 3: Error Recovery & Context (Priorité 5-7)
- [ ] Phase 4: Planning & Subagents (Priorité 8-9)
- [ ] Phase 5: Dev Runner & Git (Priorité 10-12)
- [ ] Phase 6: Background Execution (Priorité 13-14)
- [ ] Phase 7: Tests & Validation (Priorité 15)

## Notes

1. **Ne pas copier aveuglément** - Comprendre, adapter, implémenter
2. **Respecter l'architecture SoryOS-Cloud** - Rust Engine reste le cœur
3. **Toutes les exécutions doivent être réelles** - NO REAL EXECUTION = NO SUCCESS
4. **Intégration progressive** - Valider chaque étape avant de continuer
5. **Documentation complète** - Commenter chaque nouvelle fonctionnalité
6. **Tests exhaustifs** - Valider chaque composant individuellement
