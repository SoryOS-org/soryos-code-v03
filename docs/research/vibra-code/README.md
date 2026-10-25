# Vibra Code Research - Documentation Principale

> **Projet**: Extraction et Intégration des Fonctionnalités Vibra Code dans SoryOS-Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Exhaustive en Cours

---

## 🎯 OBJECTIFS DU PROJET

### Mission
Extraire la **logique utile** de Vibra Code et l'intégrer dans SoryOS-Code pour créer un **véritable agent IA** avec:
- Exécution réelle des outils
- Streaming temps réel
- Gestion de session avancée
- Contexte projet intelligent
- Récupération après erreur
- Validation des résultats

### Principes Fondamentaux
1. **NO REAL EXECUTION = NO SUCCESS** - Pas de succès simulés
2. **Rust Engine First** - Le cœur doit rester en Rust
3. **No Duplication** - Pas de deuxième AgentRuntime, ToolRegistry, etc.
4. **Merge & Extend** - Étendre plutôt que remplacer
5. **Real Tools** - Outils réels, pas de fake tool cards

---

## 📚 STRUCTURE DE LA DOCUMENTATION

```
docs/research/vibra-code/
├── README.md                    # Ce document - Vue d'ensemble
├── packages.md                  # Analyse complète des packages et logique
├── agent.md                     # Agent Loop, Intelligence, Exécution
├── tools.md                     # Système de Tools, Définitions, Exécution
├── context.md                   # Context Engine, Sources, Building
├── sessions.md                  # Session System, Lifecycle, Management
├── execution.md                 # E2B, Sandbox, Execution Provider
├── sandbox.md                   # Sandbox Management, Templates
├── realtime.md                  # Convex, Realtime, Subscriptions
├── background-jobs.md           # Inngest, Jobs, Queue, Retry
├── preview.md                   # Preview System, Tunnel, Dev Server
├── github.md                    # GitHub Integration, Push, PR
├── ai-providers.md              # AI Providers, Abstraction, Models
├── mobile.md                    # Mobile Client, Features
└── mapping.md                   # Mapping Vibra → SoryOS, Actions
```

---

## 🔍 SOURCES ANALYSÉES

### Vibra Code Repository
- **URL**: https://github.com/sa4hnd/vibra-code
- **Licence**: AGPL-3.0
- **Technologies**: Next.js, Convex, Inngest, E2B, Claude Code, Cursor, Gemini, Expo

### Structure du Repository

```
vibra-code/
├── vibracode-backend/           # Backend Principal (Next.js)
│   ├── app/                      # API Routes & Server Actions
│   │   ├── actions/              # Server Actions (agents, sessions, github)
│   │   │   ├── agents/run.ts      # Run Agent Action
│   │   │   ├── sessions/          # Session Actions
│   │   │   └── github.ts          # GitHub Actions
│   │   └── api/                   # API Routes
│   │       ├── create-session/    # Create Session API
│   │       ├── run-agent/         # Run Agent API
│   │       └── session/           # Session APIs
│   │
│   ├── lib/                       # Bibliothèques
│   │   ├── e2b/                   # E2B Configuration
│   │   │   └── config.ts          # E2BManager, Sandbox Management
│   │   ├── inngest/               # Inngest Functions
│   │   │   ├── client.ts           # Inngest Client
│   │   │   ├── functions/         # Inngest Functions
│   │   │   │   ├── run-agent.ts    # Run Agent Function
│   │   │   │   ├── create-session.ts # Create Session Function
│   │   │   │   ├── push-to-github.ts # Push to GitHub Function
│   │   │   │   └── ...
│   │   │   └── middleware.ts       # Inngest Middleware
│   │   ├── prompts/                # System Prompts
│   │   │   └── prompts.ts          # Prompt Generation
│   │   └── auth/                  # Authentication
│   │
│   ├── convex/                    # Convex Database
│   │   ├── schema.ts              # Database Schema
│   │   ├── sessions.ts            # Session Queries/Mutations
│   │   ├── messages.ts            # Message Queries/Mutations
│   │   ├── users.ts               # User Queries/Mutations
│   │   ├── costs.ts               # Cost Tracking
│   │   ├── sandbox.ts             # Sandbox State
│   │   └── ...
│   │
│   ├── config.ts                  # Configuration (Templates)
│   └── package.json               # Dependencies
│
└── vibracode-mobile/            # Mobile (Expo/React Native)
    ├── apps/                      # Applications
    │   ├── vibra-coder-eas/        # App Principale
    │   └── native-component-list/  # Catalogue Composants
    └── packages/                  # Packages Expo (100+)
        └── [expo-*, @expo/*]       # Packages Expo Standard
```

### Fichiers Clés Identifiés

| Catégorie | Fichier | Importance | Statut |
|----------|---------|------------|--------|
| Agent | `lib/inngest/functions/run-agent.ts` | ⭐⭐⭐⭐⭐ | Analysé |
| Agent | `app/actions/agents/run.ts` | ⭐⭐⭐⭐⭐ | Analysé |
| Execution | `lib/e2b/config.ts` | ⭐⭐⭐⭐⭐ | Analysé |
| Session | `convex/sessions.ts` | ⭐⭐⭐⭐⭐ | Analysé |
| Session | `convex/schema.ts` | ⭐⭐⭐⭐⭐ | Analysé |
| Session | `lib/inngest/functions/create-session.ts` | ⭐⭐⭐⭐⭐ | Analysé |
| Tools | `lib/prompts.ts` | ⭐⭐⭐⭐ | Analysé |
| Jobs | `lib/inngest.ts` | ⭐⭐⭐⭐ | Analysé |
| Realtime | `convex/*` | ⭐⭐⭐⭐ | Partiel |
| GitHub | `lib/e2b/config.ts` (commitAndPush) | ⭐⭐⭐⭐ | Analysé |
| Preview | `lib/inngest/functions/create-session.ts` | ⭐⭐⭐⭐ | Analysé |
| AI | `lib/e2b/config.ts` (executeClaudeAgent, etc.) | ⭐⭐⭐⭐ | Analysé |

---

## 🏗️ ARCHITECTURE VIBRA CODE

### Diagramme Global

```
┌─────────────────────────────────────────────────────────────────────┐
│                           VIBRA CODE ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   CLIENT    │    │   BACKEND   │    │   EXECUTION │              │
│  │  (Mobile)   │◄───►│  (Next.js)  │◄───►│   (E2B)     │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           ▲                  ▲                  ▲                     │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    CONVEX DATABASE                             │   │
│  │  (Sessions, Messages, Users, Costs, Files, Images, Videos)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           ▲                                                          │
│           │                                                          │
│  ┌─────────────┐                                                    │
│  │  INNGEST     │  (Background Jobs, Retry, Queue, Events)             │
│  │  (Workflow)  │◄───────────────────────────────────────────────────┘
│  └─────────────┘                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### User Flow

```
USER
  │
  ▼
┌─────────────────────┐
│  Mobile App / Web    │  (React Native / Next.js)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  API Request         │  (POST /api/create-session)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Inngest Event       │  (vibracode/create.session)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Create Session       │  (Inngest Function)
│  - Create E2B Sandbox │
│  - Start Dev Server  │
│  - Trigger Agent      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Run Agent           │  (Inngest Function)
│  - Connect to Sandbox │
│  - Execute Claude    │
│  - Stream Output     │
│  - Parse Tools       │
│  - Update DB         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Convex DB           │  (Persist sessions, messages)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Realtime Updates    │  (Convex Subscriptions)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Client UI           │  (Streaming responses)
└─────────────────────┘
```

---

## 🔬 ANALYSE PAR DOMAINE

### 1. Agent System (⭐⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/inngest/functions/run-agent.ts`, `app/actions/agents/run.ts`  
**Complexité**: Élevée  
**Intérêt**: MAXIMUM

**Fonctionnalités Clés**:
- ✅ Agent Loop complet (User → Session → Context → AI → Plan → Tool Call → Execution → Result → Observation → Next Action → Verification → Final Response)
- ✅ Multi-provider support (Claude, Cursor, Gemini)
- ✅ Streaming JSON output
- ✅ Tool calling (filesystem, git, terminal, etc.)
- ✅ Error handling avancé (timeout, sandbox terminated, generic errors)
- ✅ Cost tracking intégré
- ✅ Session state management
- ✅ Context building (session, messages, environment)

**À Extraire**:
1. Le **Agent Loop** complet
2. Le **Tool Calling Mechanism**
3. Le **Streaming Handler**
4. Le **Error Recovery System**
5. Le **Context Building**
6. Le **Session State Management**

**Destination SoryOS**:
- `packages/agent/src/runtime.rs` - Agent Runtime
- `packages/agent/src/loop.rs` - Agent Loop
- `packages/agent/src/context.rs` - Context Builder
- `packages/agent/src/tools.rs` - Tool Calling

---

### 2. Execution System - E2B (⭐⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/e2b/config.ts`  
**Complexité**: Élevée  
**Intérêt**: MAXIMUM

**Fonctionnalités Clés**:
- ✅ Sandbox Management (create, connect, kill, pause, resume)
- ✅ Auto-pause après inactivité (15 min par défaut)
- ✅ Template System (E2B templates)
- ✅ Command Execution (avec streaming)
- ✅ Multi-Agent Execution (Claude, Cursor, Gemini)
- ✅ Git Integration (init, commit, push)
- ✅ Tunnel/Host Management (preview URLs)
- ✅ Environment Variable Management
- ✅ Session Token Management

**À Extraire**:
1. Le **E2BManager** class
2. Le **Sandbox Lifecycle** (create, connect, pause, resume, kill)
3. Le **Command Execution** avec streaming
4. Le **Multi-Agent Execution**
5. Le **Git Integration** (commitAndPush)
6. Le **Template System**

**Destination SoryOS**:
- `packages/execution/src/e2b.rs` - E2B Execution Provider
- `packages/execution/src/manager.rs` - Execution Manager
- `packages/execution/src/templates.rs` - Template System
- `packages/github/src/manager.rs` - Git Integration

---

### 3. Session System (⭐⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `convex/sessions.ts`, `convex/schema.ts`, `lib/inngest/functions/create-session.ts`  
**Complexité**: Élevée  
**Intérêt**: MAXIMUM

**Fonctionnalités Clés**:
- ✅ Session Lifecycle (15+ états différents)
- ✅ Session Creation (avec template, repository)
- ✅ Session Resume (reconnexion à sandbox existante)
- ✅ Session Stop (arrêt manuel de l'agent)
- ✅ Session Cost Tracking
- ✅ Session Environment Variables
- ✅ Session GitHub Integration
- ✅ Session Convex Project Integration
- ✅ Message History (lié à la session)

**À Extraire**:
1. Le **Session Schema** (champs, indexes)
2. Le **Session Lifecycle**
3. Le **Session Management** (create, get, update, list)
4. Le **Cost Tracking**
5. Le **Environment Management**

**Destination SoryOS**:
- `packages/session/src/state.rs` - Session State
- `packages/session/src/manager.rs` - Session Manager
- `packages/session/src/cost.rs` - Cost Tracking
- `packages/session/src/history.rs` - Session History

---

### 4. Context Engine (⭐⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/prompts.ts`, `lib/inngest/functions/run-agent.ts`  
**Complexité**: Moyenne  
**Intérêt**: MAXIMUM

**Fonctionnalités Clés**:
- ✅ Project Context (structure, dependencies, config)
- ✅ File Context (current file, relevant files, symbols)
- ✅ Session Context (ID, history, state, cost)
- ✅ Environment Context (sandbox ID, working directory, env vars)
- ✅ Git Context (repository, branch, changes)
- ✅ Conversation Context (previous messages, tool results, errors)
- ✅ System Prompt Generation
- ✅ Dynamic Context Building

**À Extraire**:
1. Le **ContextBuilder** (combinaison de toutes les sources)
2. Le **System Prompt Generation**
3. Les **Context Sources** (Convex, E2B, GitHub, Template)
4. Le **Relevant Files Detection**

**Destination SoryOS**:
- `packages/context/src/builder.rs` - ContextBuilder
- `packages/context/src/sources.rs` - Context Sources
- `packages/context/src/prompts.rs` - System Prompts

---

### 5. Tool System (⭐⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/e2b/config.ts` (execute functions), `lib/inngest/functions/run-agent.ts` (stdout parsing)  
**Complexité**: Élevée  
**Intérêt**: MAXIMUM

**Fonctionnalités Clés**:
- ✅ Filesystem Tools (read, write, edit, search, list, delete)
- ✅ Terminal Tools (bash, shell, process)
- ✅ Git Tools (status, add, commit, push, clone, branch)
- ✅ GitHub Tools (push, PR creation)
- ✅ Project Tools (install, build, test, start)
- ✅ Preview Tools (tunnel, host detection)
- ✅ Environment Tools (set_env, get_env)
- ✅ Tool Execution avec Streaming
- ✅ Tool Result Parsing (JSON stream)
- ✅ Tool Error Handling

**À Extraire**:
1. Les **Tool Definitions** (toutes catégories)
2. Le **Tool Execution Mechanism**
3. Le **Tool Result Parsing**
4. Le **Tool Error Handling**
5. Le **Tool Streaming**

**Destination SoryOS**:
- `packages/tools/src/registry.rs` - ToolRegistry (merge)
- `packages/tools/src/executor.rs` - ToolExecutor
- `packages/tools/src/definitions/` - Tool Definitions
  - `filesystem.rs`
  - `terminal.rs`
  - `git.rs`
  - `github.rs`
  - `project.rs`
  - `preview.rs`
  - `environment.rs`

---

### 6. Background Jobs - Inngest (⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/inngest.ts`, `lib/inngest/functions/*`  
**Complexité**: Moyenne  
**Intérêt**: Élevé

**Fonctionnalités Clés**:
- ✅ Event-Driven Architecture
- ✅ Job Queue (Inngest)
- ✅ Retry Mechanism (configurable)
- ✅ Concurrency Control (25 max)
- ✅ Failure Handling (onFailure hooks)
- ✅ Step-Based Execution (step.run)
- ✅ Parallel Execution (step.run en parallèle)
- ✅ Long Running Tasks (background: true)
- ✅ Timeout Management

**À Extraire**:
1. Le **Job Queue System**
2. Le **Retry Mechanism**
3. Le **Concurrency Control**
4. Le **Failure Handling**
5. Le **Step-Based Execution**

**Destination SoryOS**:
- `packages/jobs/src/manager.rs` - JobManager
- `packages/jobs/src/queue.rs` - Job Queue
- `packages/jobs/src/worker.rs` - Job Worker
- `packages/jobs/src/retry.rs` - Retry Mechanism

---

### 7. Realtime System - Convex (⭐⭐⭐⭐)

**Statut**: Analyse Partielle  
**Fichiers**: `convex/*`  
**Complexité**: Moyenne  
**Intérêt**: Élevé

**Fonctionnalités Clés**:
- ✅ Realtime Database (Convex)
- ✅ Subscriptions (realtime updates)
- ✅ Queries & Mutations
- ✅ Offline Cache
- ✅ Automatic Sync
- ✅ Indexes pour performances
- ✅ Ownership Verification (sécurité)

**À Extraire**:
1. Le **Subscription Mechanism**
2. Le **Realtime Update System**
3. Le **State Synchronization**
4. Le **Offline Support**

**Destination SoryOS**:
- `packages/realtime/src/manager.rs` - RealtimeManager
- `packages/realtime/src/subscriptions.rs` - Subscriptions
- `packages/realtime/src/sync.rs` - State Sync

**Note**: Ne pas remplacer notre architecture par Convex, mais extraire les **concepts** et la **logique**.

---

### 8. GitHub Integration (⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/e2b/config.ts` (commitAndPush, createGitHubPullRequest)  
**Complexité**: Moyenne  
**Intérêt**: Élevé

**Fonctionnalités Clés**:
- ✅ GitHub OAuth (via Clerk)
- ✅ Repository Creation (Octokit)
- ✅ Git Initialization
- ✅ Git Commit & Push
- ✅ Pull Request Creation
- ✅ Auto-Push (après chaque modification)
- ✅ README Generation
- ✅ .gitignore Management
- ✅ Credential Management

**À Extraire**:
1. Le **GitHub Manager**
2. Le **Repository Creation**
3. Le **Commit & Push Mechanism**
4. Le **Pull Request Creation**
5. Le **Auto-Push System**

**Destination SoryOS**:
- `packages/github/src/manager.rs` - GitHubManager (merge avec existant)
- `packages/github/src/repo.rs` - Repository Management
- `packages/github/src/pr.rs` - Pull Request Management

---

### 9. Preview System (⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/inngest/functions/create-session.ts` (tunnel creation)  
**Complexité**: Moyenne  
**Intérêt**: Élevé

**Fonctionnalités Clés**:
- ✅ Dev Server Start (Expo)
- ✅ Tunnel Creation (Expo --tunnel)
- ✅ Host Detection (E2B.getHost)
- ✅ Preview URL Generation
- ✅ Health Check
- ✅ Port Detection
- ✅ Streaming Preview

**À Extraire**:
1. Le **DevRunner** amélioré
2. Le **Tunnel Management**
3. Le **Host Detection**
4. Le **Health Check**
5. Le **Port Detection**

**Destination SoryOS**:
- `packages/preview/src/runner.rs` - DevRunner (amélioré)
- `packages/preview/src/tunnel.rs` - Tunnel Management
- `packages/preview/src/detection.rs` - Port/Health Detection

---

### 10. AI Providers (⭐⭐⭐⭐)

**Statut**: Analyse Complète  
**Fichiers**: `lib/e2b/config.ts` (executeClaudeAgent, executeCursorAgent, executeGeminiAgent)  
**Complexité**: Moyenne  
**Intérêt**: Élevé

**Fonctionnalités Clés**:
- ✅ Multi-Provider Support (Claude, Cursor, Gemini)
- ✅ Provider Abstraction
- ✅ Model Selection
- ✅ API Key Management
- ✅ Streaming Output (stream-json format)
- ✅ Base64 Encoding (pour sécurité)
- ✅ Error Handling
- ✅ Continue Flag (pour reprise)

**À Extraire**:
1. Le **AI Provider Abstraction**
2. Le **Multi-Provider Support**
3. Le **Model Configuration**
4. Le **Streaming Configuration**
5. Le **Continue Mechanism**

**Destination SoryOS**:
- `packages/ai/src/provider.rs` - AIProvider (merge avec existant)
- `packages/ai/src/models.rs` - Model Configuration
- `packages/ai/src/streaming.rs` - Streaming Configuration

---

### 11. Mobile Client (⭐⭐)

**Statut**: Analyse Partielle  
**Fichiers**: `vibracode-mobile/apps/*`  
**Complexité**: Moyenne  
**Intérêt**: Faible (UI spécifique mobile)

**Fonctionnalités Clés**:
- ✅ Chat Interface (streaming)
- ✅ Tool Cards (edits, todos, results)
- ✅ Voice Input (Expo Speech)
- ✅ Image Input (Expo Image Picker)
- ✅ File Input (Expo Document Picker)
- ✅ Preview Display
- ✅ Session Management
- ✅ Model Selection
- ✅ Provider Selection

**À Extraire**:
1. Les **concepts UI** pour Tool Cards
2. Le **Streaming UI Pattern**
3. Le **Error Display**
4. Le **Session Switching**

**Destination SoryOS**:
- `apps/web/src/components/ToolCard.tsx` - Tool Cards (améliorées)
- `apps/web/src/components/Chat.tsx` - Chat Interface
- `apps/web/src/components/Streaming.tsx` - Streaming Display

**Note**: Ne pas transformer SoryOS-Code en application Expo. Extraire uniquement la **logique UI utile**.

---

## 🎯 MAPPING COMPLET VIBRA → SORYOS

### Tableau de Mapping

| Vibra Feature | Type | SoryOS Destination | Action | Priorité | Complexité | Statut |
|---------------|------|---------------------|--------|----------|------------|--------|
| Agent Loop | Logique | `packages/agent/` | ADAPT | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Agent Runtime | Logique | `packages/agent/src/runtime.rs` | REWRITE | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⏳ |
| Context Builder | Logique | `packages/context/src/builder.rs` | REWRITE | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Session System | Logique | `packages/session/` | ADAPT | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Session Schema | Données | `packages/session/src/state.rs` | ADAPT | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Session Lifecycle | Logique | `packages/session/src/manager.rs` | ADAPT | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| E2BManager | Logique | `packages/execution/src/e2b.rs` | ADAPT | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Sandbox Lifecycle | Logique | `packages/execution/src/manager.rs` | ADAPT | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Command Execution | Logique | `packages/execution/src/command.rs` | ADAPT | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Multi-Agent Execution | Logique | `packages/ai/src/executor.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Tool Definitions | Données | `packages/tools/src/definitions/` | REUSE | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Tool Registry | Logique | `packages/tools/src/registry.rs` | MERGE | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Tool Executor | Logique | `packages/tools/src/executor.rs` | MERGE | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Tool Streaming | Logique | `packages/tools/src/streaming.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Inngest Functions | Logique | `packages/jobs/` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Job Queue | Logique | `packages/jobs/src/queue.rs` | REWRITE | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Retry Mechanism | Logique | `packages/jobs/src/retry.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐ | ⏳ |
| Step Execution | Logique | `packages/jobs/src/steps.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐ | ⏳ |
| Convex Subscriptions | Logique | `packages/realtime/src/subscriptions.rs` | REWRITE | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⏳ |
| Realtime Sync | Logique | `packages/realtime/src/sync.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| GitHub Manager | Logique | `packages/github/src/manager.rs` | MERGE | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Commit & Push | Logique | `packages/github/src/commit.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Pull Request | Logique | `packages/github/src/pr.rs` | ADAPT | ⭐⭐⭐ | ⭐⭐ | ⏳ |
| DevRunner | Logique | `packages/preview/src/runner.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Tunnel Management | Logique | `packages/preview/src/tunnel.rs` | ADAPT | ⭐⭐⭐⭐ | ⭐⭐ | ⏳ |
| AI Provider | Logique | `packages/ai/src/provider.rs` | MERGE | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Model Config | Données | `packages/ai/src/models.rs` | ADAPT | ⭐⭐⭐ | ⭐⭐ | ⏳ |
| Cost Tracking | Logique | `packages/billing/src/tracker.rs` | ADAPT | ⭐⭐⭐ | ⭐⭐⭐ | ⏳ |
| Template System | Configuration | `packages/templates/` | REUSE | ⭐⭐⭐ | ⭐⭐ | ⏳ |
| Tool Cards UI | UI | `apps/web/src/components/ToolCard.tsx` | ADAPT | ⭐⭐ | ⭐⭐ | ⏳ |
| Chat UI | UI | `apps/web/src/components/Chat.tsx` | NOT NEEDED | ⭐ | ⭐ | ⏳ |
| Mobile Apps | Application | N/A | NOT NEEDED | ⭐ | ⭐ | ✅ |
| Expo Packages | Dependencies | N/A | NOT NEEDED | ⭐ | ⭐ | ✅ |

---

## 📅 PLAN D'INTÉGRATION

### Phase 1: Fondations (Semaine 1)

**Objectif**: Créer les bases pour l'intégration

| Tâche | Description | Priorité | Complexité | Durée | Statut |
|-------|-------------|----------|------------|-------|--------|
| 1.1 | Créer la documentation complète | ⭐⭐⭐⭐⭐ | ⭐⭐ | 2j | ✅ |
| 1.2 | Analyser et documenter chaque domaine | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 3j | ✅ |
| 1.3 | Créer le ContextBuilder en Rust | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |
| 1.4 | Adapter le Session System | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 2j | ⏳ |
| 1.5 | Intégrer E2B dans ExecutionProvider | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |

**Livrables**:
- Documentation complète (`docs/research/vibra-code/`)
- `packages/context/src/builder.rs` (ContextBuilder)
- `packages/session/src/state.rs` (Session State)
- `packages/session/src/manager.rs` (Session Manager)
- `packages/execution/src/e2b.rs` (E2B Integration)

---

### Phase 2: Agent Core (Semaine 2)

**Objectif**: Implémenter l'agent runtime avec streaming

| Tâche | Description | Priorité | Complexité | Durée | Statut |
|-------|-------------|----------|------------|-------|--------|
| 2.1 | Créer l'Agent Runtime en Rust | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 5j | ⏳ |
| 2.2 | Implémenter le Agent Loop | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 3j | ⏳ |
| 2.3 | Intégrer le Tool Calling | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |
| 2.4 | Ajouter le Streaming Support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 2j | ⏳ |
| 2.5 | Implémenter l'Error Recovery | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 2j | ⏳ |

**Livrables**:
- `packages/agent/src/runtime.rs` (Agent Runtime)
- `packages/agent/src/loop.rs` (Agent Loop)
- `packages/agent/src/tools.rs` (Tool Calling)
- `packages/agent/src/streaming.rs` (Streaming)
- `packages/agent/src/recovery.rs` (Error Recovery)

---

### Phase 3: Tool System (Semaine 3)

**Objectif**: Étendre le système d'outils avec les fonctionnalités Vibra

| Tâche | Description | Priorité | Complexité | Durée | Statut |
|-------|-------------|----------|------------|-------|--------|
| 3.1 | Extraire les Tool Definitions | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 2j | ⏳ |
| 3.2 | Étendre le ToolRegistry | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 2j | ⏳ |
| 3.3 | Implémenter le ToolExecutor | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |
| 3.4 | Ajouter le Tool Streaming | ⭐⭐⭐⭐ | ⭐⭐⭐ | 2j | ⏳ |
| 3.5 | Tester tous les outils | ⭐⭐⭐⭐ | ⭐⭐ | 1j | ⏳ |

**Livrables**:
- `packages/tools/src/definitions/` (toutes les définitions)
- `packages/tools/src/registry.rs` (ToolRegistry étendu)
- `packages/tools/src/executor.rs` (ToolExecutor)
- `packages/tools/src/streaming.rs` (Tool Streaming)

---

### Phase 4: Advanced Features (Semaine 4)

**Objectif**: Ajouter les fonctionnalités avancées

| Tâche | Description | Priorité | Complexité | Durée | Statut |
|-------|-------------|----------|------------|-------|--------|
| 4.1 | Implémenter Background Jobs | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |
| 4.2 | Ajouter Realtime Support | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |
| 4.3 | Intégrer GitHub | ⭐⭐⭐⭐ | ⭐⭐⭐ | 2j | ⏳ |
| 4.4 | Améliorer Preview System | ⭐⭐⭐⭐ | ⭐⭐⭐ | 2j | ⏳ |
| 4.5 | Ajouter AI Providers | ⭐⭐⭐ | ⭐⭐ | 1j | ⏳ |

**Livrables**:
- `packages/jobs/` (Background Jobs)
- `packages/realtime/` (Realtime Support)
- `packages/github/` (GitHub Integration)
- `packages/preview/` (Preview System amélioré)
- `packages/ai/` (AI Providers étendus)

---

### Phase 5: UI/UX & Tests (Semaine 5)

**Objectif**: Améliorer l'interface et tester

| Tâche | Description | Priorité | Complexité | Durée | Statut |
|-------|-------------|----------|------------|-------|--------|
| 5.1 | Améliorer les Tool Cards | ⭐⭐⭐ | ⭐⭐⭐ | 2j | ⏳ |
| 5.2 | Ajouter le Streaming UI | ⭐⭐⭐ | ⭐⭐⭐ | 2j | ⏳ |
| 5.3 | Améliorer l'Error Display | ⭐⭐⭐ | ⭐⭐ | 1j | ⏳ |
| 5.4 | Tester l'Agent | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |
| 5.5 | Tester les Tools | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 3j | ⏳ |
| 5.6 | Tester la Recovery | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 2j | ⏳ |
| 5.7 | Tester Build & Preview | ⭐⭐⭐⭐ | ⭐⭐⭐ | 2j | ⏳ |

**Livrables**:
- `apps/web/src/components/ToolCard.tsx` (améliorées)
- `apps/web/src/components/Chat.tsx` (streaming)
- `apps/web/src/components/ErrorDisplay.tsx`
- Tests complets de toutes les fonctionnalités

---

### Phase 6: Documentation & Finalisation (Semaine 6)

**Objectif**: Finaliser la documentation et pousser sur GitHub

| Tâche | Description | Priorité | Complexité | Durée | Statut |
|-------|-------------|----------|------------|-------|--------|
| 6.1 | Mettre à jour AGENTS.md | ⭐⭐⭐⭐ | ⭐⭐ | 1j | ⏳ |
| 6.2 | Créer la documentation utilisateur | ⭐⭐⭐ | ⭐⭐ | 2j | ⏳ |
| 6.3 | Vérifier la licence (AGPL-3.0) | ⭐⭐⭐⭐ | ⭐ | 1j | ⏳ |
| 6.4 | Faire un audit de code | ⭐⭐⭐⭐ | ⭐⭐ | 1j | ⏳ |
| 6.5 | Pousser sur GitHub (main) | ⭐⭐⭐⭐⭐ | ⭐ | 1j | ⏳ |

**Livrables**:
- `AGENTS.md` (mis à jour)
- Documentation utilisateur complète
- Audit de code et vérification licence
- Code poussé sur GitHub main

---

## 🎯 RAPPORT FINAL ATTENDU

À la fin du projet, nous devons avoir:

```
VIBRA CODE EXTRACTION
=====================

Packages discovered: 100+
Packages analyzed: 100+
Packages skipped: 100+ (Expo standard packages)

Agent logic extracted: PASS
Tool logic extracted: PASS
Context logic extracted: PASS
Session logic extracted: PASS
Execution logic extracted: PASS
Sandbox logic extracted: PASS
Background jobs analyzed: PASS
Realtime logic analyzed: PASS
Preview logic extracted: PASS
GitHub logic analyzed: PASS
AI provider logic analyzed: PASS
Mobile logic analyzed: PASS

SoryOS integrations: 20+
Reimplemented: 15+
Adapted: 10+
Merged: 5+
Not needed: 70+

Duplicated runtimes: 0
Fake executions: 0
Fake success states: 0

Tests:
Agent: PASS
Tools: PASS
Filesystem: PASS
Terminal: PASS
Recovery: PASS
Build: PASS
Preview: PASS

Documentation:
Vibra research: PASS
Architecture mapping: PASS
AGENTS.md: PASS
```

---

## 📌 RÈGLES À RESPECTER

### ⭐ Règles Absolues

1. **NO REAL EXECUTION = NO SUCCESS** - Jamais de succès simulés
2. **Rust Engine First** - Le cœur doit rester en Rust
3. **No Duplication** - Pas de deuxième AgentRuntime, ToolRegistry, etc.
4. **Merge & Extend** - Étendre les systèmes existants
5. **Real Tools** - Outils réels, pas de fake tool cards

### ⭐ Règles de Licence (AGPL-3.0)

1. **Ne pas copier** du code source directement (sauf si réimplémentation propre)
2. **Extraire la logique** et réimplémenter en Rust
3. **Conserver les notices** si du code est effectivement réutilisé
4. **Ne pas supprimer** les mentions de copyright
5. **Ne pas présenter** du code tiers comme du code SoryOS

### ⭐ Règles d'Architecture

1. **Project → Workspace → Session → Environment → Provider** reste l'architecture principale
2. **AI Provider** reste séparé de **Execution Provider**
3. **Le Rust Engine** reste le cœur
4. **Pas de simulation** - Tout doit être réel

---

## 🔗 LIENS UTILES

- [Vibra Code Repository](https://github.com/sa4hnd/vibra-code)
- [SoryOS-Code Repository](https://github.com/SoryOS-org/soryos-cloud)
- [E2B Documentation](https://e2b.dev/docs)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Claude Code SDK](https://github.com/anthropics/claude-code-sdk)
- [Cursor Agent](https://cursor.com/agent)
- [Expo Documentation](https://docs.expo.dev)
- [Rust Documentation](https://doc.rust-lang.org)

---

## 📝 NOTES

- Ce document est un **work in progress** et sera mis à jour au fur et à mesure de l'analyse
- La priorité est de **comprendre la logique** avant de commencer l'implémentation
- Chaque phase doit être **testée** avant de passer à la suivante
- La documentation doit être **complète et précise**

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse en Cours
