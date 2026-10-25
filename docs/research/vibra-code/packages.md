# Vibra Code - Analyse Complète des Packages

> **Date**: 2025-10-08  
> **Source**: https://github.com/sa4hnd/vibra-code  
> **Statut**: Analyse Exhaustive  
> **Licence Source**: AGPL-3.0

---

## 📊 SOMMAIRE EXÉCUTIF

### Packages Découverts
- **Total packages dans vibracode-mobile/packages/**: ~100+ (principalement des packages Expo standard)
- **Packages Vibra spécifiques**: 0 dans packages/ (la logique est dans le backend)
- **Fichiers source principaux**: Dans `vibracode-backend/`

### Architecture Principale
```
Vibra Code
├── vibracode-backend/ (Next.js + Convex + Inngest + E2B)
│   ├── app/ (API Routes, Server Actions)
│   │   ├── actions/ (agents, sessions, github, stripe)
│   │   └── api/ (create-session, run-agent, session/*)
│   ├── lib/ (e2b, inngest, prompts, hooks)
│   │   ├── e2b/config.ts (E2BManager, Sandbox Management)
│   │   ├── inngest/ (functions: run-agent, create-session, push-to-github)
│   │   └── prompts.ts (System prompts, context building)
│   └── convex/ (Database Schema & Queries)
│       ├── schema.ts (sessions, messages, users, costs)
│       ├── sessions.ts (session management)
│       ├── messages.ts (message handling)
│       └── sandbox.ts (sandbox state)
│
└── vibracode-mobile/ (Expo/React Native)
    ├── apps/ (vibra-coder-eas, native-component-list, etc.)
    └── packages/ (100+ packages Expo standard)
```

---

## 🔍 ANALYSE DÉTAILLÉE PAR DOMAINE

---

## 1. 🤖 AGENT SYSTEM

### 1.1 Agent Loop

**Fichier**: `vibracode-backend/lib/inngest/functions/run-agent.ts`

**Architecture du Loop**:
```
USER
  ↓
SESSION (Convex DB)
  ↓
CONTEXT (Session Data + Messages + Environment)
  ↓
AI PROVIDER (Claude/Cursor/Gemini)
  ↓
PLAN (Implicit via Agent SDK)
  ↓
TOOL CALL (E2B Sandbox Execution)
  ↓
EXECUTION (Command in Sandbox)
  ↓
RESULT (Streaming JSON Output)
  ↓
OBSERVATION (Stdout/Stderr Parsing)
  ↓
NEXT ACTION (Agent Decision)
  ↓
VERIFICATION (Cost Tracking, Error Handling)
  ↓
FINAL RESPONSE (Message to User)
```

**Composants Clés**:

| Composant | Fichier | Responsabilité |
|-----------|---------|----------------|
| `runAgent` | `lib/inngest/functions/run-agent.ts` | Fonction Inngest principale |
| `E2BManager` | `lib/e2b/config.ts` | Gestion des sandboxes |
| `executeClaudeAgent` | `lib/e2b/config.ts` | Exécution Claude |
| `executeCursorAgent` | `lib/e2b/config.ts` | Exécution Cursor |
| `executeGeminiAgent` | `lib/e2b/config.ts` | Exécution Gemini |

**Fonctionnement**:
1. **Réception**: Inngest reçoit l'événement `vibracode/run.agent`
2. **Connexion**: Connection à la sandbox E2B existante via `sessionId`
3. **Exécution**: Lance la commande Claude/Cursor/Gemini dans la sandbox
4. **Streaming**: Parse le stdout en JSON (format stream-json)
5. **Traitement**: Extrait les messages, edits, todos, tool calls
6. **Persistance**: Sauve dans Convex DB (messages, session status)
7. **Gestion d'erreur**: Handler de failure pour timeout/sandbox terminated

**Providers Supportés**:
- Claude (Opus, Sonnet, Haiku)
- Cursor Agent
- Gemini

**Modèle de Streaming**:
```typescript
// Format attendu du stdout
{ type: "message", role: "assistant", content: "...", delta: true }
{ type: "edit", filePath: "...", oldString: "...", newString: "..." }
{ type: "todo", id: "...", status: "in_progress/completed", description: "..." }
```

**Gestion des Erreurs**:
- Timeout: Message utilisateur friendly
- Sandbox Terminated: Message de reprise
- Erreurs générales: Sanitization des secrets avant affichage

---

### 1.2 Agent Intelligence

**System Prompt**: `lib/prompts.ts`

**Caractéristiques**:
- **Contexte Projet**: Comprend la structure du projet via le filesystem
- **Mémoire Session**: Historique des messages dans Convex
- **Outils Disponibles**: Accès complet au terminal, filesystem, git
- **Planification**: Capacité à décomposer les tâches complexes
- **Validation**: Vérification des changements avant commit

**Exemple de Prompt Système**:
```typescript
// Extrait de lib/prompts.ts
const getSystemPrompt = (context: SessionContext) => `
You are Vibra Code, an AI-powered mobile app builder.

## Context
- Current directory: ${context.cwd}
- Session ID: ${context.sessionId}
- Project: ${context.projectName}
- Template: ${context.template}

## Capabilities
- Read/write files
- Execute terminal commands
- Run npm/yarn/pnpm
- Git operations
- Install dependencies
- Start/stop dev servers

## Rules
- Always verify file changes
- Use streaming JSON output
- Handle errors gracefully
- Respect user intent
...`
```

---

## 2. 🛠️ TOOL SYSTEM

### 2.1 Outils Principaux

**Catégorie: Filesystem**

| Tool ID | Name | Description | Execution |
|---------|------|-------------|-----------|
| `read` | Read File | Lit le contenu d'un fichier | `cat <file>` |
| `write` | Write File | Crée/écrit un fichier | `echo > <file>` |
| `edit` | Edit File | Modifie un fichier existant | `sed/sdk edit` |
| `search` | Search Files | Recherche dans les fichiers | `grep/rg` |
| `list` | List Files | Liste les fichiers d'un dossier | `ls -la` |
| `delete` | Delete File | Supprime un fichier | `rm <file>` |

**Catégorie: Terminal/Shell**

| Tool ID | Name | Description | Execution |
|---------|------|-------------|-----------|
| `bash` | Execute Command | Exécute une commande shell | `bash -c "..."` |
| `shell` | Shell Session | Session shell interactive | `sh` |
| `process` | Process Manager | Gère les processus | `ps aux \| grep` |

**Catégorie: Git**

| Tool ID | Name | Description | Execution |
|---------|------|-------------|-----------|
| `git_status` | Git Status | État du repo git | `git status` |
| `git_add` | Git Add | Ajoute des fichiers | `git add <files>` |
| `git_commit` | Git Commit | Commit les changements | `git commit -m` |
| `git_push` | Git Push | Push vers remote | `git push` |
| `git_clone` | Git Clone | Clone un repo | `git clone` |
| `git_branch` | Git Branch | Gestion des branches | `git branch` |

**Catégorie: GitHub**

| Tool ID | Name | Description | Execution |
|---------|------|-------------|-----------|
| `github_push` | Push to GitHub | Push le code vers GitHub | `E2BManager.commitAndPush()` |
| `github_pr` | Create PR | Crée une Pull Request | `createGitHubPullRequest()` |

**Catégorie: Project**

| Tool ID | Name | Description | Execution |
|---------|------|-------------|-----------|
| `install` | Install Deps | Installe les dépendances | `npm install` |
| `build` | Build Project | Build le projet | `npm run build` |
| `test` | Run Tests | Exécute les tests | `npm test` |
| `start` | Start Server | Démarre le dev server | `npx expo start` |

**Catégorie: Preview**

| Tool ID | Name | Description | Execution |
|---------|------|-------------|-----------|
| `preview` | Preview App | Obtient l'URL de preview | `getSandboxHost(port)` |
| `tunnel` | Create Tunnel | Crée un tunnel | `expo start --tunnel` |

**Catégorie: Environment**

| Tool ID | Name | Description | Execution |
|---------|------|-------------|-----------|
| `set_env` | Set Environment | Configure les env vars | `export VAR=value` |
| `get_env` | Get Environment | Lit les env vars | `printenv` |

### 2.2 Mécanisme d'Exécution des Outils

**Flow**:
```
Agent Request
  ↓
Tool Selection (Claude/Cursor/Gemini SDK)
  ↓
Command Construction (Base64 encoding pour sécurité)
  ↓
E2B Sandbox Execution (via Sandbox.commands.run)
  ↓
Stream Handling (stdout/stderr parsing)
  ↓
Result Extraction (JSON parsing, delta updates)
  ↓
State Update (Convex DB)
  ↓
User Feedback (Streaming response)
```

**Sécurité**:
- Base64 encoding des prompts pour éviter les problèmes de shell escaping
- Sanitization des secrets dans les messages d'erreur
- Timeout configurable par commande
- Auto-pause des sandboxes inactives

---

## 3. 🏗️ CONTEXT ENGINE

### 3.1 Types de Contexte

**Project Context**:
- Structure du projet (fichiers, dossiers)
- Dependencies (package.json)
- Configuration (tsconfig.json, etc.)
- Template utilisé

**File Context**:
- Fichier actuel ouvert
- Fichiers pertinents (relevant files)
- Symboles et définitions
- Contenu des fichiers

**Session Context**:
- ID de session
- Historique des messages
- État actuel (status, statusMessage)
- Coût accumulé
- Environnement variables

**Environment Context**:
- Sandbox ID (E2B)
- Working directory (/vibe0)
- Session token
- Git configuration

**Git Context**:
- Repository URL
- Branch actuelle
- Commit history
- Changes non commités

**Conversation Context**:
- Messages précédents
- Actions de l'agent
- Résultats des outils
- Erreurs rencontrées

### 3.2 ContextBuilder (Conceptuel)

**Implémentation dans Vibra**:
```typescript
// Dans lib/prompts.ts
interface SessionContext {
  sessionId: string;
  sessionDbId: Id<"sessions">;
  userId: string;
  cwd: string;
  projectName: string;
  template: Template;
  messages: Message[];
  envs: Record<string, string>;
  sandboxId: string;
  tunnelUrl?: string;
  githubRepository?: string;
}

const buildContext = async (sessionId: string): Promise<SessionContext> => {
  // 1. Get session data from Convex
  const session = await getSessionData(sessionId);
  
  // 2. Get messages
  const messages = await getSessionMessages(sessionId);
  
  // 3. Get environment variables
  const envs = session.envs || {};
  
  // 4. Build final context
  return {
    sessionId: session.sessionId,
    sessionDbId: session._id,
    userId: session.createdBy,
    cwd: '/vibe0',
    projectName: session.name,
    template: templates.find(t => t.id === session.templateId),
    messages,
    envs,
    sandboxId: session.sessionId,
    tunnelUrl: session.tunnelUrl,
    githubRepository: session.githubRepository,
  };
};
```

**Sources de Contexte**:
1. **Convex Database**: sessions, messages, users
2. **E2B Sandbox**: filesystem, process list, env vars
3. **GitHub API**: repository info, PR status
4. **Template Config**: start commands, secrets, image

---

## 4. 💾 SESSION SYSTEM

### 4.1 Structure de Session

**Schema Convex** (`convex/schema.ts`):
```typescript
export const sessions = defineTable({
  createdBy: v.optional(v.string()),      // Clerk user ID
  sessionId: v.optional(v.string()),       // E2B sandbox ID
  name: v.string(),                       // Session name (auto-generated)
  tunnelUrl: v.optional(v.string()),       // Preview URL
  repository: v.optional(v.string()),      // GitHub repository
  templateId: v.string(),                  // Template utilisé
  pullRequest: v.optional(v.any()),        // PR info
  // GitHub
  githubRepository: v.optional(v.string()),
  githubRepositoryUrl: v.optional(v.string()),
  githubPushStatus: v.optional(v.union(...)), // pending/in_progress/completed/failed
  githubPushDate: v.optional(v.number()),
  // Status
  status: v.union(                         // État actuel
    v.literal('IN_PROGRESS'),
    v.literal('CLONING_REPO'),
    v.literal('INSTALLING_DEPENDENCIES'),
    v.literal('STARTING_DEV_SERVER'),
    v.literal('CREATING_TUNNEL'),
    v.literal('CUSTOM'),
    v.literal('RUNNING'),
    // ... 15+ autres états
  ),
  statusMessage: v.optional(v.string()),
  // Agent control
  agentStopped: v.optional(v.boolean()),
  // Cost tracking
  totalCostUSD: v.optional(v.number()),
  messageCount: v.optional(v.number()),
  lastCostUpdate: v.optional(v.number()),
  // Environment
  envs: v.optional(v.record(v.string(), v.string())),
  // Convex Project
  convexProject: v.optional(v.object({...})),
})
```

### 4.2 Lifecycle de Session

```
CRÉATION
  ↓
CLONING_REPO (si repository fourni)
  ↓
INSTALLING_DEPENDENCIES (skip si template pré-configuré)
  ↓
STARTING_DEV_SERVER
  ↓
CREATING_TUNNEL
  ↓
RUNNING (Agent démarre)
  ↓
CUSTOM (Tâche en cours)
  ↓
RUNNING (Agent continue)
  ↓
... (boucle jusqu'à completion)
  ↓
PUSHING_TO_GITHUB (optionnel)
  ↓
COMPLETED/FAILED
```

### 4.3 Gestion des Sessions

**Création**:
- Trigger: POST /api/create-session
- Action: Envoie événement Inngest `vibracode/create.session`
- Résultat: Création sandbox E2B + démarrage agent

**Reprise**:
- Trigger: POST /api/session/resume
- Action: Reconnecte à sandbox existante via `E2BManager.connectToSandbox()`
- Résultat: Agent reprend où il s'était arrêté

**Arrêt**:
- Trigger: POST /api/session/stop-agent
- Action: Met `agentStopped: true` dans Convex
- Résultat: Agent s'arrête après la commande en cours

**Destruction**:
- Trigger: Session timeout (15 min inactivité)
- Action: E2B auto-pause + cleanup
- Résultat: Sandbox pause, peut être résumée

### 4.4 Historique et État

**Messages**: Stockés dans table `messages` avec:
- `sessionId`: Liens à la session
- `role`: user/assistant
- `content`: Message texte
- `edits`: Modifications de fichiers
- `todos`: Tâches à faire
- `toolCalls`: Appels d'outils

**Coût Tracking**:
- `totalCostUSD`: Coût total de la session
- `messageCount`: Nombre de messages
- `lastCostUpdate`: Timestamp dernière mise à jour

---

## 5. ⚙️ EXECUTION SYSTEM (E2B)

### 5.1 E2BManager

**Fichier**: `lib/e2b/config.ts`

**Fonctionnalités**:
- Création de sandboxes
- Connexion à sandboxes existantes
- Exécution de commandes
- Exécution d'agents (Claude/Cursor/Gemini)
- Gestion du lifecycle (pause/resume/kill)
- Gestion des tunnels et hosts
- Initialisation Git
- Commit & Push vers GitHub

**Configuration**:
```typescript
interface E2BSandboxConfig {
  templateId?: string;      // E2B template ID
  apiKey?: string;         // E2B API key
  envVars?: Record<string, string>;  // Variables d'environnement
  timeout?: number;        // Timeout auto-pause (default: 15 min)
}
```

### 5.2 Sandbox Lifecycle

```
CREATION
  ↓
Sandbox.betaCreate(templateId, { apiKey, envs, autoPause: true, timeoutMs })
  ↓
Attente du session token (/vibe0/.session_token)
  ↓
Génération si nécessaire
  ↓
Écriture des fichiers .env.local et .expo_env
  ↓
Sandbox prête
  ↓
CONNEXION (pour sessions existantes)
  ↓
Sandbox.connect(sandboxId, { timeoutMs })
  ↓
Reset timeout
  ↓
Sandbox connectée
  ↓
EXÉCUTION
  ↓
Sandbox.commands.run(command, { onStdout, onStderr, background, timeoutMs, envs })
  ↓
Streaming des résultats
  ↓
PAUSE (après inactivité)
  ↓
Sandbox.betaPause()
  ↓
RESUME
  ↓
Sandbox.connect() + setTimeout()
  ↓
KILL
  ↓
Sandbox.kill()
  ↓
Cleanup
```

### 5.3 Template System

**Configuration** (`config.ts`):
```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  image: string;           // E2B template ID
  secrets: Record<string, string>;  // Env vars par défaut
  startCommands: Array<{
    command: string;
    status: string;
    background: boolean;
  }>;
}
```

**Templates Disponibles**:
- Blank (Expo)
- React Native
- Next.js
- Custom templates

### 5.4 Command Execution

**Fonction**: `executeCommand(sandbox, command, options)`

**Options**:
- `onStdout`: Callback pour stdout streaming
- `onStderr`: Callback pour stderr streaming
- `background`: Exécuter en arrière-plan
- `cwd`: Working directory
- `envVars`: Variables d'environnement supplémentaires
- `timeoutMs`: Timeout pour la commande

**Retour**:
```typescript
{
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

### 5.5 Agent Execution

**Claude Agent**:
```typescript
export async function executeClaudeAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    isFirstMessage?: boolean;
    model?: string;
    mcpConfig?: Record<string, any>;
  }
) {
  const claudeModel = options.model || 'claude-opus-4-5-20251101';
  const continueFlag = options.isFirstMessage ? '' : '--continue';
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
  
  const command = `
    export ANTHROPIC_API_KEY='${apiKey}' &&
    export ANTHROPIC_BASE_URL='${baseUrl}' &&
    echo '${promptBase64}' | base64 -d | 
    claude -p --output-format stream-json --verbose 
    --dangerously-skip-permissions ${mcpFlag} ${continueFlag} 
    --model ${claudeModel}
  `;
  
  return executeCommand(sandbox, command, { ...options, cwd: '/vibe0' });
}
```

**Cursor Agent**:
```typescript
const cursorCommand = `
  echo '${promptBase64}' | base64 -d | 
  cursor-agent --api-key ${apiKey} -p --output-format stream-json 
  --force --model auto ${resumeFlag}
`;
```

**Gemini Agent**:
```typescript
const geminiCommand = `
  export GEMINI_API_KEY='${apiKey}' && 
  echo '${promptBase64}' | base64 -d | 
  gemini --output-format stream-json --yolo
`;
```

---

## 6. 📦 BACKGROUND JOBS (Inngest)

### 6.1 Inngest Configuration

**Fichier**: `lib/inngest.ts`

**Fonctions Inngest**:
1. `runAgent` - Exécute l'agent dans la sandbox
2. `createSession` - Crée une nouvelle session
3. `pushToGitHub` - Push le code vers GitHub
4. `generateVideo` - Génère une vidéo de démonstration
5. `generateImage` - Génère une image
6. `stealApp` - Copie une app existante

### 6.2 Inngest Features

**Retries**:
- `run-agent`: 0 retries (géré manuellement)
- `create-session`: 0 retries
- Autres: configuration par défaut

**Concurrency**:
- Limite à 25 exécutions simultanées

**Failure Handling**:
- Handler `onFailure` pour chaque fonction
- Sanitization des erreurs avant affichage
- Messages utilisateur friendly pour timeout/sandbox terminated

### 6.3 Event Flow

```
User Request (API Route)
  ↓
Inngest.send({ name: "vibracode/run.agent", data: {...} })
  ↓
Inngest Queue
  ↓
Function Execution (runAgent)
  ↓
Step.run("generate code", async () => {...})
  ↓
E2B Sandbox Execution
  ↓
Streaming Results
  ↓
Convex DB Updates
  ↓
User Response (Streaming)
```

### 6.4 Long Running Tasks

**Mécanismes**:
- `background: true` pour les commandes longues
- `timeoutMs: 0` pour désactiver le timeout
- `requestTimeoutMs: 900000` (15 min) pour le timeout HTTP
- Auto-pause des sandboxes après 15 min d'inactivité

**Reprise**:
- Connection à sandbox existante via `sessionId`
- Reset du timeout auto-pause
- Continuation de l'agent avec `--continue` flag

---

## 7. 🔄 REALTIME SYSTEM (Convex)

### 7.1 Convex Architecture

**Database**:
- `sessions`: Informations des sessions
- `messages`: Historique des messages
- `users`: Informations utilisateurs
- `costs`: Tracking des coûts
- `files`: Fichiers uploadés
- `images`: Images générées
- `videos`: Vidéos générées

**Queries**:
- `list`: Liste des sessions d'un utilisateur
- `getById`: Récupère une session spécifique
- `getByIdInternal`: Récupère une session sans vérification (backend only)

**Mutations**:
- `create`: Crée une nouvelle session
- `update`: Met à jour une session
- `addMessage`: Ajoute un message à une session
- `updateStatus`: Met à jour le statut

### 7.2 Realtime Features

**Subscriptions**:
- Convex support les subscriptions pour le realtime
- Les clients peuvent s'abonner aux sessions et messages
- Mise à jour automatique lors des changements

**Sync State**:
- Le statut de la session est synchronisé en temps réel
- Les messages sont streamés au client
- Les coûts sont mis à jour en temps réel

**Offline Support**:
- Convex gère le cache local
- Synchronisation automatique lors de la reconnexion

### 7.3 Communication Flow

```
Client (Mobile/Web)
  ↓
Convex Query (list sessions)
  ↓
Convex Database
  ↓
Response (sessions avec messages)
  ↓
Client Subscription
  ↓
Realtime Updates (nouveaux messages, statut)
  ↓
UI Update
```

---

## 8. 🌐 GITHUB INTEGRATION

### 8.1 GitHub Flow

```
User Request (Push to GitHub)
  ↓
POST /api/session/push-to-github
  ↓
Inngest Event: vibracode/push.to.github
  ↓
E2BManager.commitAndPush()
  ↓
Initialisation Git (si nécessaire)
  ↓
Configuration des credentials
  ↓
git add .
  ↓
git commit -m "..."
  ↓
git push origin main
  ↓
Création de Pull Request (optionnel)
  ↓
Mise à jour du statut dans Convex
```

### 8.2 GitHub Configuration

**Authentification**:
- OAuth via Clerk
- Token stocké dans Convex (users table)
- Utilisé pour les opérations GitHub

**Repository Creation**:
- Création automatique via Octokit
- Nom basé sur le projet
- README.md généré automatiquement

**Pull Request**:
- Création via `createGitHubPullRequest()`
- Title: "🚀 VibraCode"
- Head: "vibracode"
- Base: "main"

### 8.3 Auto-Push

**Mécanisme**:
- Détection des changements dans la sandbox
- Commit automatique après chaque modification majeure
- Push automatique vers GitHub
- Statut synchronisé dans l'UI

**Configuration**:
- `githubPushStatus`: pending/in_progress/completed/failed
- `githubPushDate`: Timestamp du dernier push
- `githubRepository`: Nom du repository (owner/repo)
- `githubRepositoryUrl`: URL du repository

---

## 9. 🎨 PREVIEW SYSTEM

### 9.1 Preview Flow

```
Dev Server Start
  ↓
Expo Tunnel Creation
  ↓
E2B Host Detection
  ↓
getSandboxHost(port)
  ↓
Tunnel URL (https://*.sandbox.e2b.dev)
  ↓
Client Preview
```

### 9.2 Preview Configuration

**Ports**:
- Dev server: 3000 (Expo)
- Autres ports: configurables

**Commands**:
```typescript
// Démarrage du dev server avec tunnel
"npx expo start --tunnel --port 3000"

// Obtention de l'URL
await e2bManager.getHost(3000);
// Retourne: https://<sandbox-id>.sandbox.e2b.dev
```

### 9.3 Preview Features

- **Tunnel automatique**: Créé via Expo
- **Host detection**: E2B.getHost(port)
- **Health check**: Vérification que le serveur répond
- **Streaming**: Preview en temps réel des changements

---

## 10. 💰 AI PROVIDERS

### 10.1 Provider Abstraction

**Interface**:
```typescript
interface AIProvider {
  execute(prompt: string, options: AIOptions): Promise<AIResult>;
}
```

**Providers Implémentés**:

| Provider | Model | API Key | Command |
|----------|-------|---------|---------|
| Claude | Opus/Sonnet/Haiku | ANTHROPIC_API_KEY | `claude -p --output-format stream-json` |
| Cursor | Auto | CURSOR_AGENT_API_KEY | `cursor-agent --api-key` |
| Gemini | Default | GEMINI_API_KEY | `gemini --output-format stream-json` |

### 10.2 Provider Configuration

**Environnement Variables**:
```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://api.anthropic.com
CURSOR_AGENT_API_KEY=...
GEMINI_API_KEY=...
E2B_API_KEY=...
```

**Modèle Selection**:
- Claude: Configurable via `model` parameter
- Cursor: Auto selection
- Gemini: Modèle par défaut

### 10.3 Streaming Configuration

**Format**: `stream-json` (newline-delimited JSON)

**Options**:
- `--output-format stream-json`: Format de sortie
- `--verbose`: Logs détaillés
- `--dangerously-skip-permissions`: Skip les vérifications de permissions
- `--continue`: Continuer une session existante
- `--model`: Spécifier le modèle

---

## 11. 📱 MOBILE CLIENT

### 11.1 Mobile Architecture

**Technologies**:
- React Native (Expo)
- TypeScript
- NativeWind (Tailwind CSS)
- Expo Router

**Apps**:
- `vibra-coder-eas`: Application principale
- `native-component-list`: Catalogue de composants
- Autres apps de test

### 11.2 Mobile Features

**Chat Interface**:
- Messages streamés en temps réel
- Historique des sessions
- Support Markdown
- Code syntax highlighting

**Tool Cards**:
- Affichage des edits de fichiers
- Statut des tâches (todos)
- Résultats des commandes
- Erreurs et warnings

**Input**:
- Texte
- Voice (via Expo Speech)
- Images (via Expo Image Picker)
- Fichiers (via Expo Document Picker)

**Preview**:
- Preview web dans l'app
- QR code pour Expo Go
- Lien direct vers la sandbox

---

## 12. 🎯 TEMPLATES

### 12.1 Template System

**Configuration** (`config.ts`):
```typescript
export const templates: Template[] = [
  {
    id: "blank",
    name: "Blank App",
    description: "Start from scratch",
    image: "e2b-template-id",
    secrets: {},
    startCommands: [
      { command: "npx expo start --tunnel --port 3000", status: "Starting dev server", background: true }
    ]
  },
  {
    id: "react-native",
    name: "React Native",
    description: "React Native template",
    image: "rn-template-id",
    secrets: {},
    startCommands: [
      { command: "npm install", status: "Installing dependencies", background: false },
      { command: "npx expo start --tunnel --port 3000", status: "Starting dev server", background: true }
    ]
  }
];
```

### 12.2 Template Features

- **Pré-configurés**: Dependencies déjà installées
- **Auto-start**: Commandes de démarrage automatiques
- **Secrets**: Variables d'environnement par défaut
- **Custom**: Templates personnalisables

---

## 13. 📊 COST TRACKING

### 13.1 Cost Model

**Billing Modes**:
1. **Token Mode** (Cursor): Messages limités par période
2. **Credit Mode** (Claude): Crédits en USD (2x multiplier)

**Tracking**:
- `totalCostUSD`: Coût total de la session
- `realCostUSD`: Coût réel API (internal)
- `creditsUSD`: Crédits disponibles (affichage utilisateur)
- `profitUSD`: Profit backend
- `messagesRemaining`: Messages restants (token mode)
- `messagesUsed`: Messages utilisés

### 13.2 Cost Calculation

**Claude**:
- Coût basé sur le nombre de tokens
- Multiplicateur 2x pour l'affichage utilisateur
- Tracking via stdout parsing (usage information)

**Cursor**:
- Coût basé sur le nombre de messages
- Limite mensuelle
- Reset automatique à la fin de la période

---

## 14. 🔐 AUTHENTICATION

### 14.1 Auth Providers

**Clerk**:
- Authentication principale
- OAuth GitHub
- User management
- Session management

**NextAuth**:
- Alternative pour certaines routes
- Support multi-providers

### 14.2 Auth Flow

```
User Sign In (Clerk)
  ↓
Clerk User Creation
  ↓
Convex User Record Creation
  ↓
GitHub OAuth (optionnel)
  ↓
Token Storage (Convex users table)
  ↓
Session Creation
```

---

## 15. 📈 MONITORING & ANALYTICS

### 15.1 Usage Tracking

**Metrics**:
- Sessions créées
- Messages envoyés
- Coût total
- Temps d'exécution
- Erreurs

**Tables Convex**:
- `usage`: Tracking d'utilisation
- `costs`: Coûts par session
- `sessions`: Métadonnées sessions

### 15.2 Error Tracking

**Types d'erreurs**:
- Timeout
- Sandbox terminated
- Permission denied
- API errors
- Network errors

**Handling**:
- Sanitization des messages d'erreur
- Messages utilisateur friendly
- Logging détaillé pour le debugging

---

## 🎯 MAPPING VERS SORYOS-CODE

### Packages/Logique Vibra → Destination SoryOS

| Vibra Feature | Type | SoryOS Destination | Action | Priorité |
|---------------|------|---------------------|--------|----------|
| Agent Loop | Logique | `packages/agent/` | ADAPT | ⭐⭐⭐⭐⭐ |
| E2BManager | Logique | `packages/execution/` | ADAPT | ⭐⭐⭐⭐⭐ |
| Tool Execution | Logique | `packages/tools/` | MERGE | ⭐⭐⭐⭐⭐ |
| Context Builder | Logique | `packages/context/` | REWRITE | ⭐⭐⭐⭐⭐ |
| Session System | Logique | `packages/session/` | ADAPT | ⭐⭐⭐⭐⭐ |
| Inngest Functions | Logique | `packages/jobs/` | ADAPT | ⭐⭐⭐⭐ |
| Convex Realtime | Architecture | `packages/realtime/` | REWRITE | ⭐⭐⭐⭐ |
| GitHub Integration | Logique | `packages/github/` | MERGE | ⭐⭐⭐⭐ |
| Preview System | Logique | `packages/preview/` | ADAPT | ⭐⭐⭐⭐ |
| AI Providers | Logique | `packages/ai/` | ADAPT | ⭐⭐⭐⭐ |
| Cost Tracking | Logique | `packages/billing/` | ADAPT | ⭐⭐⭐ |
| Template System | Configuration | `packages/templates/` | REUSE | ⭐⭐⭐ |
| Mobile UI | UI | `apps/web/` | NOT NEEDED | ⭐ |
| Expo Packages | Dependencies | N/A | NOT NEEDED | ⭐ |

### Actions Recommandées

1. **⭐⭐⭐⭐⭐ CRITIQUE - Agent Runtime**
   - Extraire la logique `run-agent` et l'adapter au Rust Engine
   - Intégrer le streaming JSON output
   - Implémenter le tool calling dans le Rust Engine
   - **Destination**: `packages/agent/src/runtime.rs`

2. **⭐⭐⭐⭐⭐ CRITIQUE - Execution Provider**
   - Adapter `E2BManager` pour fonctionner avec notre `ExecutionProvider`
   - Conserver l'auto-pause/timeout
   - Intégrer la gestion des templates
   - **Destination**: `packages/execution/src/e2b.rs`

3. **⭐⭐⭐⭐⭐ CRITIQUE - Context Engine**
   - Créer un `ContextBuilder` basé sur le système Vibra
   - Combiner Project + Workspace + Session + Environment + Provider
   - Ajouter Git context, relevant files, symbols
   - **Destination**: `packages/context/src/builder.rs`

4. **⭐⭐⭐⭐⭐ CRITIQUE - Session System**
   - Adapter le schema de session Vibra
   - Intégrer avec notre `SessionManager`
   - Ajouter le tracking de coût
   - **Destination**: `packages/session/src/state.rs`

5. **⭐⭐⭐⭐ IMPORTANT - Tool System**
   - Extraire les définitions d'outils (filesystem, git, terminal)
   - Intégrer avec notre `ToolRegistry`
   - Ajouter le streaming output
   - **Destination**: `packages/tools/src/registry.rs`

6. **⭐⭐⭐⭐ IMPORTANT - Background Jobs**
   - Adapter Inngest pour notre système de jobs
   - Implémenter retry, timeout, concurrency
   - **Destination**: `packages/jobs/src/manager.rs`

7. **⭐⭐⭐⭐ IMPORTANT - Realtime**
   - Créer un système realtime inspiré de Convex
   - WebSocket subscriptions
   - State synchronization
   - **Destination**: `packages/realtime/src/manager.rs`

8. **⭐⭐⭐ IMPORTANT - GitHub Integration**
   - Extraire la logique `commitAndPush`
   - Intégrer avec notre Git provider
   - **Destination**: `packages/github/src/manager.rs`

9. **⭐⭐⭐ IMPORTANT - Preview System**
   - Adapter le DevRunner avec le tunnel E2B
   - Health check, port detection
   - **Destination**: `packages/preview/src/runner.rs`

10. **⭐⭐⭐ IMPORTANT - AI Providers**
    - Extraire l'abstraction provider
    - Intégrer avec notre AI Provider system
    - **Destination**: `packages/ai/src/provider.rs`

---

## 🚀 RECOMMANDATIONS

### Architecture Cible

```
SoryOS-Code (Amélioré avec Vibra)
├── packages/
│   ├── agent/           # Agent Runtime + Loop (inspiré Vibra)
│   │   ├── src/runtime.rs      # Agent execution loop
│   │   ├── src/context.rs      # Context building
│   │   └── src/tools.rs         # Tool calling
│   │
│   ├── execution/       # Execution Provider (E2B + Local)
│   │   ├── src/e2b.rs           # E2B sandbox management
│   │   ├── src/manager.rs      # Execution manager
│   │   └── src/templates.rs    # Template system
│   │
│   ├── session/         # Session Management
│   │   ├── src/state.rs         # Session state
│   │   ├── src/cost.rs          # Cost tracking
│   │   └── src/history.rs       # Session history
│   │
│   ├── context/         # Context Engine
│   │   └── src/builder.rs       # ContextBuilder
│   │
│   ├── tools/           # Tool System
│   │   ├── src/registry.rs      # ToolRegistry (merge Vibra tools)
│   │   ├── src/executor.rs      # ToolExecutor
│   │   └── src/definitions/     # Tool definitions
│   │       ├── filesystem.rs
│   │       ├── git.rs
│   │       ├── terminal.rs
│   │       └── ...
│   │
│   ├── jobs/            # Background Jobs
│   │   ├── src/manager.rs       # JobManager (Inngest-like)
│   │   ├── src/queue.rs         # Job queue
│   │   └── src/worker.rs        # Job worker
│   │
│   ├── realtime/        # Realtime System
│   │   ├── src/manager.rs       # RealtimeManager
│   │   └── src/subscriptions.rs # Subscriptions
│   │
│   ├── github/          # GitHub Integration
│   │   └── src/manager.rs       # GitHubManager
│   │
│   ├── preview/         # Preview System
│   │   └── src/runner.rs        # DevRunner (amélioré)
│   │
│   └── ai/              # AI Providers
│       └── src/provider.rs      # AIProvider abstraction
│
└── apps/
    ├── web/             # Web Interface
    ├── cli/             # CLI
    └── api/             # API Server
```

### Principes à Respecter

1. **Rust Engine First**: Toute logique critique doit être en Rust
2. **No Duplication**: Ne pas créer de deuxième AgentRuntime, ToolRegistry, etc.
3. **Merge & Extend**: Étendre les systèmes existants plutôt que remplacer
4. **Real Execution**: Pas de fake tool cards, pas de succès simulés
5. **Streaming**: Tout doit supporter le streaming
6. **Error Recovery**: Gestion robuste des erreurs et reprise
7. **Cost Tracking**: Suivi précis des coûts et ressources

### Ordre d'Intégration

1. **Fondation** (Semaine 1)
   - ContextBuilder
   - Session System
   - Execution Provider (E2B)

2. **Core Agent** (Semaine 2)
   - Agent Runtime
   - Tool System
   - AI Providers

3. **Advanced** (Semaine 3)
   - Background Jobs
   - Realtime System
   - GitHub Integration
   - Preview System

4. **UI/UX** (Semaine 4)
   - Tool Cards améliorées
   - Streaming UI
   - Error display

---

## 📝 PROCHAINES ÉTAPES

1. ✅ **Analyse Complète** - TERMINÉ
2. ⏳ **Créer la documentation détaillée** (agent.md, tools.md, context.md, etc.)
3. ⏳ **Implémenter le ContextBuilder** en Rust
4. ⏳ **Adapter le Session System**
5. ⏳ **Intégrer E2B dans ExecutionProvider**
6. ⏳ **Créer l'Agent Runtime** avec streaming
7. ⏳ **Étendre le ToolRegistry** avec les outils Vibra
8. ⏳ **Tester et valider** chaque composant
9. ⏳ **Mettre à jour AGENTS.md**
10. ⏳ **Pousser sur GitHub** (main)

---

## 🔗 LIENS UTILES

- [Vibra Code Repository](https://github.com/sa4hnd/vibra-code)
- [E2B Documentation](https://e2b.dev/docs)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Claude Code SDK](https://github.com/anthropics/claude-code-sdk)
- [Cursor Agent](https://cursor.com/agent)
- [Expo Documentation](https://docs.expo.dev)

---

## 📄 MÉTADONNÉES

- **Auteur**: SoryOS Team
- **Date**: 2025-10-08
- **Version**: 1.0
- **Statut**: Analyse Complète
- **Prochaine Révision**: Après implémentation Phase 1
