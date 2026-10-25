# Vibra Code - Agent System Analysis

> **Projet**: Extraction de la logique Agent de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [Agent Loop](#-agent-loop)
3. [Agent Intelligence](#-agent-intelligence)
4. [Agent Execution](#-agent-execution)
5. [Tool Calling](#-tool-calling)
6. [Streaming System](#-streaming-system)
7. [Error Handling](#-error-handling)
8. [Context Management](#-context-management)
9. [Session Integration](#-session-integration)
10. [Cost Tracking](#-cost-tracking)
11. [Multi-Provider Support](#-multi-provider-support)
12. [Comparison avec SoryOS](#-comparison-avec-soryos)
13. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture de l'Agent Vibra

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VIBRA CODE AGENT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   USER      │    │   SESSION   │    │   CONTEXT   │              │
│  │  Request    │───►│  Management  │───►│   BUILDER    │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        AGENT RUNTIME                            │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │   │
│  │  │  AI PROVIDER │    │ TOOL CALLING│    │ STREAMING   │        │   │
│  │  │ (Claude/     │    │ (Filesystem, │    │ (JSON Output)│        │   │
│  │  │  Cursor/     │    │  Git,        │    │             │        │   │
│  │  │  Gemini)     │    │  Terminal)   │    │             │        │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     E2B SANDBOX EXECUTION                         │   │
│  │  - Command Execution                                            │   │
│  │  - File Operations                                              │   │
│  │  - Process Management                                           │   │
│  │  - Network Access                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     RESULT PROCESSING                            │   │
│  │  - Stdout/Stderr Parsing                                         │   │
│  │  - JSON Stream Extraction                                        │   │
│  │  - Tool Result Handling                                          │   │
│  │  - Error Detection & Recovery                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     STATE PERSISTENCE                             │   │
│  │  - Convex DB Updates                                             │   │
│  │  - Session State Management                                      │   │
│  │  - Message History                                               │   │
│  │  - Cost Tracking                                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     REALTIME UPDATES                              │   │
│  │  - Convex Subscriptions                                          │   │
│  │  - Streaming to Client                                            │   │
│  │  - UI Updates                                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `lib/inngest/functions/run-agent.ts` | Fonction principale de l'agent | ⭐⭐⭐⭐⭐ | 1200+ |
| `app/actions/agents/run.ts` | Server Action pour lancer l'agent | ⭐⭐⭐⭐ | 150 |
| `lib/e2b/config.ts` | Exécution des agents (Claude/Cursor/Gemini) | ⭐⭐⭐⭐⭐ | 700+ |
| `lib/prompts.ts` | Génération des prompts système | ⭐⭐⭐⭐ | 600+ |
| `lib/inngest/middleware.ts` | Middleware pour Inngest | ⭐⭐⭐ | 150 |

---

## 🔄 AGENT LOOP

### Flow Complet

```
USER
  │
  ▼
┌─────────────────────┐
│  Input Validation    │  (sessionId, message, template, repository)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Billing Check       │  (Pre-flight: credits, tokens, billing mode)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Inngest Event       │  (vibracode/run.agent)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Session Data Load   │  (Convex: session, messages, envs)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  E2B Sandbox         │  (Connect to existing sandbox via sessionId)
│  Connection          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Context Building    │  (Project, File, Session, Environment, Git)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  System Prompt       │  (Dynamic generation based on context)
│  Construction        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AI Provider         │  (Claude/Cursor/Gemini selection)
│  Execution           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Command Execution   │  (Base64 encoded prompt via E2B sandbox)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Streaming Output    │  (JSON newline-delimited from stdout)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Output Parsing      │  (Parse JSON: messages, edits, todos, tool calls)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Tool Execution      │  (Si tool call détecté: execute dans sandbox)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Result Processing   │  (Extract results, update state, persist)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  State Update        │  (Convex: session status, messages, cost)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Realtime Update     │  (Convex subscriptions → Client UI)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Next Action         │  (Continue, Stop, Error Recovery)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Verification        │  (Cost tracking, error handling, validation)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Final Response      │  (Streaming to user)
└─────────────────────┘
```

### Détail du Loop dans le Code

**Source**: `lib/inngest/functions/run-agent.ts`

```typescript
export const runAgent = inngest.createFunction(
  {
    id: "run-agent",
    retries: 0,           // Pas de retry automatique (géré manuellement)
    concurrency: 25,      // Max 25 exécutions simultanées
    onFailure: async ({ error, event }) => {
      // Handler de failure pour timeout, sandbox terminated, etc.
    },
  },
  { event: "vibracode/run.agent" },
  async ({ event, step }) => {
    // 1. Extraction des données de l'événement
    const { sessionId, id, message, template, model } = event.data;
    
    // 2. Préparation du contexte
    const sessionData = await getSessionData(id);
    
    // 3. Reset du flag agentStopped
    await fetchMutation(api.sessions.update, { id, agentStopped: false });
    
    // 4. Connexion à la sandbox E2B
    const e2bManager = new E2BManager({ templateId: template?.image, envVars: template?.secrets });
    await e2bManager.connectToSandbox(sessionId);
    
    // 5. Mise à jour du statut
    await updateSessionStatus(id, "CUSTOM", "Working on task");
    
    // 6. Préparation des handlers stdout/stderr
    let streamingContent = "";
    let accumulatedStdout = "";
    let jsonBuffer = "";
    
    // 7. Handler stdout pour parsing JSON
    const handleStdout = async (data: string) => {
      const eventTimestamp = Date.now();
      accumulatedStdout += data + "\n";
      jsonBuffer += data;
      
      // Parse des lignes JSON complètes
      const lines = jsonBuffer.split('\n');
      jsonBuffer = lines.pop() || "";
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        try {
          const parsedData = JSON.parse(trimmedLine);
          await processStdoutLine(parsedData, eventTimestamp);
        } catch (parseError) {
          console.error("Error parsing stdout line:", parseError);
        }
      }
    };
    
    // 8. Exécution de l'agent
    await step.run("generate code", async () => {
      // Exécution selon le provider
      if (model?.startsWith('claude')) {
        await executeClaudeAgent(e2bManager.getSandbox()!, message, {
          onStdout: handleStdout,
          onStderr: handleStderr,
          isFirstMessage: isFirstMessage,
          model: model,
        });
      } else if (model?.startsWith('gemini')) {
        await executeGeminiAgent(e2bManager.getSandbox()!, message, {
          onStdout: handleStdout,
          onStderr: handleStderr,
        });
      } else {
        await executeCursorAgent(e2bManager.getSandbox()!, message, {
          onStdout: handleStdout,
          onStderr: handleStderr,
          isFirstMessage: isFirstMessage,
        });
      }
    });
    
    // 9. Retour du résultat
    return { success: true, sessionId, messageId: id };
  }
);
```

---

## 🧠 AGENT INTELLIGENCE

### System Prompt

**Source**: `lib/prompts.ts`

Le system prompt est généré dynamiquement en fonction du contexte de la session:

```typescript
export const getSystemPrompt = (context: SessionContext): string => `
You are Vibra Code, an AI-powered mobile app builder.

## Your Role
You are an expert React Native developer. Your job is to help users build mobile apps by writing code, fixing bugs, and implementing features.

## Context
- Current directory: ${context.cwd}
- Session ID: ${context.sessionId}
- Project: ${context.projectName}
- Template: ${context.template?.name || 'Custom'}
- User: ${context.userId}

## Available Files
${context.relevantFiles?.map(f => `- \`${f.path}\`: ${f.description}`).join('\n') || 'No files yet'}

## Project Structure
${context.projectStructure || 'Empty project'}

## Current State
${context.statusMessage || 'Starting fresh'}

## Capabilities
✅ Read and write files
✅ Execute terminal commands
✅ Run npm/yarn/pnpm commands
✅ Perform git operations (add, commit, push)
✅ Install dependencies
✅ Start and stop development servers
✅ Create and modify React Native components
✅ Handle TypeScript types
✅ Use Expo APIs
✅ Access environment variables

## Rules
1. ALWAYS verify your changes work before presenting them
2. Use TypeScript for all new files
3. Follow React Native best practices
4. Use functional components with hooks
5. Add proper error handling
6. Include necessary imports
7. Use meaningful variable and function names
8. Add comments for complex logic
9. Test your code when possible
10. Ask for clarification if the request is ambiguous

## Output Format
ALWAYS use the JSON stream format for tool interactions:

For messages:
{
  "type": "message",
  "role": "assistant",
  "content": "Your message here",
  "delta": true
}

For file edits:
{
  "type": "edit",
  "filePath": "path/to/file.ts",
  "oldString": "old code to replace",
  "newString": "new code"
}

For todos:
{
  "type": "todo",
  "id": "unique-id",
  "status": "in_progress",
  "description": "Task description"
}

For tool calls:
{
  "type": "tool_call",
  "name": "bash",
  "arguments": {"command": "ls -la"}
}

## Environment
- Node.js version: ${context.nodeVersion || '18+'}
- npm/yarn/pnpm: Available
- Expo CLI: Available
- Git: Available
- Working directory: ${context.cwd || '/vibe0'}

## Important
- The user is counting on you to build their app correctly
- Double-check your work
- Be thorough and careful
- If you make a mistake, acknowledge it and fix it
`;
```

### Context Building

**Sources de Contexte**:

1. **Project Context**
   - Structure du projet (fichiers, dossiers)
   - Dependencies (package.json)
   - Configuration (tsconfig.json, etc.)
   - Template utilisé

2. **File Context**
   - Fichier actuel ouvert
   - Fichiers pertinents (relevant files)
   - Symboles et définitions
   - Contenu des fichiers

3. **Session Context**
   - ID de session
   - Historique des messages
   - État actuel (status, statusMessage)
   - Coût accumulé

4. **Environment Context**
   - Sandbox ID (E2B)
   - Working directory (/vibe0)
   - Session token
   - Git configuration

5. **Git Context**
   - Repository URL
   - Branch actuelle
   - Commit history
   - Changes non commités

6. **Conversation Context**
   - Messages précédents
   - Actions de l'agent
   - Résultats des outils
   - Erreurs rencontrées

### Capacités de l'Agent

| Capacité | Description | Implémentation |
|----------|-------------|----------------|
| Code Generation | Génère du code React Native/TypeScript | ✅ |
| Code Reading | Lit les fichiers existants | ✅ |
| Code Editing | Modifie les fichiers | ✅ |
| Dependency Management | Installe/met à jour les dépendances | ✅ |
| Project Creation | Crée de nouveaux projets | ✅ |
| Bug Fixing | Identifie et corrige les bugs | ✅ |
| Feature Implementation | Implémente de nouvelles fonctionnalités | ✅ |
| Testing | Crée et exécute des tests | ✅ |
| Debugging | Debug le code | ✅ |
| Documentation | Génère de la documentation | ✅ |
| Git Operations | Gère git (add, commit, push) | ✅ |
| GitHub Integration | Push vers GitHub, crée des PR | ✅ |
| Preview | Démarre le serveur de dev et crée un tunnel | ✅ |

---

## ⚙️ AGENT EXECUTION

### Multi-Provider Support

**Providers Supportés**:

| Provider | Modèle | Commande | API Key |
|----------|--------|----------|---------|
| Claude | Opus, Sonnet, Haiku | `claude -p --output-format stream-json` | ANTHROPIC_API_KEY |
| Cursor | Auto | `cursor-agent --api-key <key> -p --output-format stream-json` | CURSOR_AGENT_API_KEY |
| Gemini | Default | `gemini --output-format stream-json --yolo` | GEMINI_API_KEY |

**Sélection du Provider**:
```typescript
const executeAgent = async (
  sandbox: Sandbox,
  prompt: string,
  provider: 'claude' | 'cursor' | 'gemini',
  options: AgentOptions
) => {
  switch (provider) {
    case 'claude':
      return executeClaudeAgent(sandbox, prompt, options);
    case 'gemini':
      return executeGeminiAgent(sandbox, prompt, options);
    default:
      return executeCursorAgent(sandbox, prompt, options);
  }
};
```

### Commande d'Exécution

**Claude**:
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
  
  const anthropicKey = process.env.ANTHROPIC_SANDBOX_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  
  if (!anthropicKey) throw new Error('ANTHROPIC_SANDBOX_API_KEY environment variable is required');
  
  // Construction de la commande avec base64 pour éviter les problèmes de shell escaping
  const claudeCommand = `
    export ANTHROPIC_API_KEY='${anthropicKey}' &&
    export ANTHROPIC_BASE_URL='${anthropicBaseUrl}' &&
    echo '${promptBase64}' | base64 -d | 
    claude -p --output-format stream-json --verbose 
    --dangerously-skip-permissions ${mcpFlag} ${continueFlag} 
    --model ${claudeModel}
  `;
  
  return executeCommand(sandbox, claudeCommand, { ...options, cwd: '/vibe0' });
}
```

**Cursor**:
```typescript
export async function executeCursorAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    isFirstMessage?: boolean;
  }
) {
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
  const resumeFlag = options.isFirstMessage ? '' : '--resume=vibracode';
  const cursorApiKey = process.env.CURSOR_AGENT_API_KEY;
  
  if (!cursorApiKey) throw new Error('CURSOR_AGENT_API_KEY environment variable is required');
  
  const cursorCommand = `
    echo '${promptBase64}' | base64 -d | 
    cursor-agent --api-key ${cursorApiKey} -p --output-format stream-json 
    --force --model auto ${resumeFlag}
  `;
  
  return executeCommand(sandbox, cursorCommand, { ...options, cwd: '/vibe0' });
}
```

**Gemini**:
```typescript
export async function executeGeminiAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  }
) {
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY environment variable is required');
  
  const geminiCommand = `
    export GEMINI_API_KEY='${geminiApiKey}' && 
    echo '${promptBase64}' | base64 -d | 
    gemini --output-format stream-json --yolo
  `;
  
  return executeCommand(sandbox, geminiCommand, { ...options, cwd: '/vibe0' });
}
```

### Sécurité

**Base64 Encoding**:
- Tous les prompts sont encodés en base64 avant d'être passés à la commande
- Évite les problèmes de shell escaping (backticks, quotes, etc.)
- Décodage dans la sandbox via `echo '<base64>' | base64 -d`

**Secret Management**:
- Les API keys sont injectées via des variables d'environnement
- Sanitization des erreurs avant affichage (remplacement des secrets par [REDACTED])
- Pas de logging des API keys

**Dangerously Skip Permissions**:
- Flag `--dangerously-skip-permissions` utilisé pour Claude
- Permet à l'agent d'exécuter des commandes sans confirmation
- Nécessaire pour l'automatisation complète

---

## 🛠️ TOOL CALLING

### Mécanisme

L'agent utilise le format **stream-json** pour communiquer avec l'extérieur:

**Format des Messages**:

1. **Message**:
```json
{
  "type": "message",
  "role": "assistant",
  "content": "Je vais créer un nouveau composant...",
  "delta": true
}
```

2. **Edit**:
```json
{
  "type": "edit",
  "filePath": "src/components/Button.tsx",
  "oldString": "const Button = () => {\n  return <button>Click</button>;\n};",
  "newString": "const Button = ({ children }: { children: React.ReactNode }) => {\n  return <button>{children}</button>;\n};"
}
```

3. **Todo**:
```json
{
  "type": "todo",
  "id": "create-button-component",
  "status": "in_progress",
  "description": "Créer un composant Button réutilisable"
}
```

4. **Tool Call**:
```json
{
  "type": "tool_call",
  "name": "bash",
  "arguments": {
    "command": "npm install react-native"
  }
}
```

### Parsing des Outils

**Source**: `lib/inngest/functions/run-agent.ts` (processStdoutLine)

```typescript
const processStdoutLine = async (parsedData: any, eventTimestamp: number) => {
  try {
    // 1. Messages
    if (parsedData.type === "message") {
      if (parsedData.role === "user") {
        // Message utilisateur
        const userContent = typeof parsedData.content === "string"
          ? parsedData.content
          : parsedData.content?.[0]?.content || "";
        await updateSessionStatus(id, "CUSTOM", userContent);
      } else if (parsedData.role === "assistant") {
        // Message assistant
        await updateSessionStatus(id, "CUSTOM", "Working on task");
        
        // Streaming content
        let content = "";
        if (Array.isArray(parsedData.content)) {
          content = parsedData.content
            .filter((c: any) => c?.type === "text")
            .map((c: any) => c.text)
            .join("");
        } else if (typeof parsedData.content === "string") {
          content = parsedData.content;
        } else if (parsedData.content?.content) {
          content = parsedData.content.content;
        }
        
        if (content) {
          streamingContent += content;
          
          // Ajout du message à la DB
          const messageId = await addMessage(id, streamingContent, "assistant", eventTimestamp);
          lastAssistantMessageId = messageId;
          
          // Reset pour le prochain message
          if (!parsedData.delta) {
            streamingContent = "";
          }
        }
      }
    }
    
    // 2. Edits
    else if (parsedData.type === "edit") {
      const { filePath, oldString, newString } = parsedData;
      
      // Validation
      if (!filePath || !oldString || !newString) {
        console.warn("Invalid edit:", parsedData);
        return;
      }
      
      // Extraction des infos de coût
      const costInfo = extractCostFromEdit(oldString, newString);
      accumulatedCost += costInfo.cost;
      
      // Sauvegarde dans la DB
      await addMessage(id, JSON.stringify(parsedData), "assistant", eventTimestamp, {
        type: "edit",
        filePath,
        oldString,
        newString,
      });
      
      // Mise à jour du statut
      await updateSessionStatus(id, "CUSTOM", `Edited ${filePath}`);
    }
    
    // 3. Todos
    else if (parsedData.type === "todo") {
      const { id: todoId, status, description } = parsedData;
      
      // Sauvegarde dans la DB
      await addMessage(id, JSON.stringify(parsedData), "assistant", eventTimestamp, {
        type: "todo",
        todoId,
        status,
        description,
      });
      
      // Mise à jour du statut de la session
      if (status === "completed") {
        await updateSessionStatus(id, "CUSTOM", `Completed: ${description}`);
      }
    }
    
    // 4. Tool Calls
    else if (parsedData.type === "tool_call") {
      const { name, arguments } = parsedData;
      
      // Exécution de l'outil dans la sandbox
      if (name === "bash" && arguments?.command) {
        const result = await e2bManager.executeCommand(arguments.command, {
          onStdout: (data) => handleStdout(data),
          onStderr: (data) => handleStderr(data),
        });
        
        // Sauvegarde du résultat
        await addMessage(id, JSON.stringify({
          type: "tool_result",
          name,
          arguments,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          },
        }), "assistant", eventTimestamp);
      }
      
      // Autres outils...
    }
    
    // 5. Autres types
    else {
      console.log("Unknown stdout type:", parsedData.type);
    }
    
  } catch (error) {
    console.error("Error processing stdout line:", error);
  }
};
```

### Outils Disponibles

| Catégorie | Outils | Description |
|----------|--------|-------------|
| Filesystem | read, write, edit, search, list, delete | Opérations sur les fichiers |
| Terminal | bash, shell | Exécution de commandes |
| Git | git_status, git_add, git_commit, git_push, git_clone | Opérations git |
| GitHub | github_push, create_pr | Intégration GitHub |
| Project | install, build, test, start | Gestion du projet |
| Preview | preview, tunnel | Preview de l'application |
| Environment | set_env, get_env | Gestion des variables d'environnement |

### Exécution des Outils

Les outils sont exécutés directement dans la sandbox E2B:

```typescript
// Exemple: Exécution d'une commande bash
const result = await e2bManager.executeCommand(
  arguments.command,
  {
    onStdout: (data) => handleStdout(data),
    onStderr: (data) => handleStderr(data),
    cwd: '/vibe0',
    envVars: { ...process.env, ...session.envs },
  }
);
```

---

## 📡 STREAMING SYSTEM

### Format de Streaming

**Format**: Newline-delimited JSON (NDJSON)

**Exemple de Stream**:
```
{"type":"message","role":"assistant","content":"Bonjour","delta":true}
{"type":"message","role":"assistant","content":" je vais ","delta":true}
{"type":"message","role":"assistant","content":"créer un composant.","delta":true}
{"type":"message","role":"assistant","content":"","delta":false}
{"type":"edit","filePath":"src/Button.tsx","oldString":"...","newString":"..."}
{"type":"todo","id":"1","status":"in_progress","description":"Créer Button"}
```

### Gestion du Buffer

Pour gérer les lignes JSON incomplètes (chunked):

```typescript
let jsonBuffer = "";

const handleStdout = async (data: string) => {
  jsonBuffer += data;
  
  // Séparation par nouvelles lignes
  const lines = jsonBuffer.split('\n');
  
  // La dernière ligne peut être incomplète
  jsonBuffer = lines.pop() || "";
  
  // Traitement de chaque ligne complète
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    try {
      const parsedData = JSON.parse(trimmedLine);
      await processStdoutLine(parsedData, Date.now());
    } catch (parseError) {
      console.error("Error parsing:", parseError);
    }
  }
};
```

### Streaming vers le Client

1. **Convex Subscriptions**: Les clients s'abonnent aux sessions
2. **Realtime Updates**: Les messages sont poussés en temps réel
3. **Delta Updates**: Seuls les nouveaux contenus sont envoyés
4. **UI Updates**: Le client met à jour l'interface en streaming

---

## 🚨 ERROR HANDLING

### Types d'Erreurs

| Type | Description | Handling |
|------|-------------|----------|
| Timeout | L'agent prend trop de temps | Message friendly + suggestion de continuer |
| Sandbox Terminated | La sandbox a été terminée | Message de reprise + conservation du state |
| Permission Denied | Permission refusée | Message d'erreur + suggestion |
| API Error | Erreur API (Claude/Cursor/Gemini) | Sanitization + message générique |
| Network Error | Problème réseau | Retry automatique |
| Parse Error | Erreur de parsing JSON | Log + skip |
| Unknown Error | Erreur inconnue | Sanitization + message générique |

### Failure Handler

**Source**: `lib/inngest/functions/run-agent.ts` (onFailure)

```typescript
onFailure: async ({ error, event }) => {
  console.log('🔴 RUN AGENT FAILURE HANDLER:', error?.message);
  
  const { id } = event.data as { id: Id<"sessions"> };
  
  try {
    const errorMessage = error?.message || String(error);
    
    // 1. Timeout
    const isTimeout = errorMessage.includes('FUNCTION_INVOCATION_TIMEOUT') ||
                      errorMessage.includes('timeout') ||
                      errorMessage.includes('Timeout') ||
                      errorMessage.includes('timed out');
    
    // 2. Sandbox Terminated
    const isSandboxTerminated = errorMessage.includes('terminated') ||
                                errorMessage.includes('[unknown]') ||
                                errorMessage.includes('SandboxError');
    
    // Reset du statut
    await updateSessionStatus(id, "RUNNING");
    
    if (isTimeout) {
      // Message friendly pour timeout
      const timeoutMessage = `⏱️ **Request Timed Out**\n\nThe AI took too long to respond. This can happen with complex tasks.\n\n**To continue:**\n• Send a new message to resume where we left off\n• Try breaking your request into smaller steps\n• Type "continue" to pick up from here\n\nYour progress has been saved.`;
      await addMessage(id, timeoutMessage, "assistant");
    } else if (isSandboxTerminated) {
      // Message pour sandbox terminée
      const sandboxMessage = `🔄 **Session Interrupted**\n\nThe development environment was temporarily unavailable. This can happen due to server maintenance or high demand.\n\n**To continue:**\n• Send a new message and I'll pick up where we left off\n• Your code and progress have been saved\n• Type "continue" to resume\n\nIf this keeps happening, try starting a new session.`;
      await addMessage(id, sandboxMessage, "assistant");
    } else {
      // Sanitization des secrets
      let sanitizedError = errorMessage;
      const secretPatterns = [
        /sk-ant-[a-zA-Z0-9-]+/g,
        /sk-[a-zA-Z0-9-]{20,}/g,
        /ghp_[a-zA-Z0-9]+/g,
        /Bearer\s+[a-zA-Z0-9._-]+/gi,
        /api[_-]?key["\s:=]+[a-zA-Z0-9._-]+/gi,
        // ... autres patterns
      ];
      
      for (const pattern of secretPatterns) {
        sanitizedError = sanitizedError.replace(pattern, '[REDACTED]');
      }
      
      // Message générique
      await addMessage(id, `⚠️ **Agent Error**\n\nSomething went wrong. Please try again.\n\n\`\`\`\n${sanitizedError}\n\`\`\``, "assistant");
    }
    
  } catch (failureError) {
    console.error('❌ Failed to handle failure:', failureError);
  }
}
```

### Error Recovery

1. **Timeout Recovery**:
   - L'utilisateur peut envoyer un nouveau message
   - L'agent reprend où il s'était arrêté
   - Le contexte est conservé

2. **Sandbox Terminated Recovery**:
   - Reconnexion automatique à la sandbox
   - Reset du timeout auto-pause
   - Continuation de l'agent

3. **Permission Error Recovery**:
   - Suggestion de vérifier les permissions
   - Option de réessayer avec `--dangerously-skip-permissions`

---

## 📋 SESSION INTEGRATION

### Session Lifecycle dans l'Agent

```
SESSION CREATION
  │
  ▼
┌─────────────────────┐
│  Initial State       │  (status: IN_PROGRESS)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Agent Start         │  (status: RUNNING)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Working on Task     │  (status: CUSTOM, statusMessage: "Working on task")
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Tool Execution      │  (status: CUSTOM, statusMessage: "Executing command")
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Processing Result   │  (status: CUSTOM, statusMessage: "Processing result")
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Next Action         │  (status: RUNNING ou CUSTOM)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Completion/Error    │  (status: RUNNING ou error message)
└─────────────────────┘
```

### Session Data Utilisée

```typescript
interface SessionData {
  id: Id<"sessions">;              // Convex DB ID
  sessionId: string;                // E2B Sandbox ID
  name: string;                    // Session name
  status: SessionStatus;            // État actuel
  statusMessage: string;           // Message de statut
  createdBy: string;               // Clerk user ID
  templateId: string;               // Template utilisé
  tunnelUrl?: string;               // Preview URL
  agentStopped: boolean;            // True si agent arrêté manuellement
  totalCostUSD: number;             // Coût total
  messageCount: number;             // Nombre de messages
  envs: Record<string, string>;     // Variables d'environnement
  githubRepository?: string;       // Repository GitHub
  convexProject?: ConvexProject;    // Projet Convex
}
```

### Session Updates

```typescript
// Mise à jour du statut
const updateSessionStatus = async (
  sessionId: Id<"sessions">,
  status: SessionStatus,
  statusMessage?: string,
  tunnelUrl?: string,
  sandboxId?: string
) => {
  const { fetchMutation } = await import("convex/nextjs");
  const { api } = await import("@/convex/_generated/api");
  
  await fetchMutation(api.sessions.update, {
    id: sessionId,
    status,
    statusMessage,
    tunnelUrl,
    sessionId: sandboxId,
  });
};

// Ajout d'un message
const addMessage = async (
  sessionId: Id<"sessions">,
  content: string,
  role: "user" | "assistant",
  timestamp?: number,
  metadata?: any
) => {
  const { fetchMutation } = await import("convex/nextjs");
  const { api } = await import("@/convex/_generated/api");
  
  const messageId = await fetchMutation(api.messages.add, {
    sessionId,
    content,
    role,
    metadata,
  });
  
  return messageId;
};
```

---

## 💰 COST TRACKING

### Mécanisme de Tracking

1. **Accumulation des Coûts**:
   - Chaque edit, tool call, message contribue au coût
   - Extraction des infos de coût depuis le stdout
   - Accumulation dans `accumulatedCost`

2. **Mise à jour de la Session**:
   - Mise à jour périodique du coût total
   - Persistance dans Convex DB

3. **Billing Check**:
   - Vérification avant chaque exécution
   - Blocage si crédits insuffisants

**Source**: `app/actions/agents/run.ts` (Pre-flight check)

```typescript
// Vérification des crédits avant de lancer l'agent
const MIN_CREDITS_REQUIRED = 0.10; // Minimum credits (before 4x multiplier)

const sessionData = await fetchQuery(api.sessions.getByIdInternal, { id: id as Id<"sessions"> });
const clerkId = sessionData?.createdBy;

if (clerkId) {
  const billingStatus = await fetchQuery(api.billingSwitch.getBillingStatus, { clerkId });
  
  if (billingStatus?.billingMode === 'credits') {
    const creditsRemaining = billingStatus?.creditsRemaining || 0;
    if (creditsRemaining < MIN_CREDITS_REQUIRED * 4) {
      // Message d'erreur
      await fetchMutation(api.messages.add, {
        sessionId: id as Id<"sessions">,
        content: `⚠️ **Insufficient Credits**\n\nYou have $${creditsRemaining.toFixed(2)} credits remaining...`,
        role: "assistant",
      });
      
      return {
        success: false,
        error: 'insufficient_credits',
        message: `Insufficient credits. You have $${creditsRemaining.toFixed(2)} but need at least $${(MIN_CREDITS_REQUIRED * 4).toFixed(2)}.`
      };
    }
  } else {
    // Token mode
    const tokensRemaining = billingStatus?.tokensRemaining || 0;
    if (tokensRemaining <= 0) {
      // Message d'erreur
      await fetchMutation(api.messages.add, {
        sessionId: id as Id<"sessions">,
        content: `⚠️ **No Messages Remaining**\n\nYou've used all your messages...`,
        role: "assistant",
      });
      
      return {
        success: false,
        error: 'no_tokens',
        message: 'No messages remaining in your plan.'
      };
    }
  }
}
```

---

## 🔀 MULTI-PROVIDER SUPPORT

### Provider Abstraction

```typescript
interface AIProvider {
  name: string;
  models: string[];
  apiKeyEnvVar: string;
  baseUrlEnvVar?: string;
  commandTemplate: (prompt: string, options: AgentOptions) => string;
}

const providers: Record<string, AIProvider> = {
  claude: {
    name: "Claude",
    models: ["claude-opus-4-5-20251101", "claude-3-5-sonnet-20250620", "claude-3-haiku-20240307"],
    apiKeyEnvVar: "ANTHROPIC_SANDBOX_API_KEY",
    baseUrlEnvVar: "ANTHROPIC_BASE_URL",
    commandTemplate: (prompt, options) => {
      const model = options.model || providers.claude.models[0];
      const continueFlag = options.isFirstMessage ? '' : '--continue';
      const mcpFlag = options.mcpConfig ? `--mcp-config "$(echo '${btoa(JSON.stringify(options.mcpConfig))}' | base64 -d)"` : '';
      return `export ANTHROPIC_API_KEY='${process.env.ANTHROPIC_SANDBOX_API_KEY}' && export ANTHROPIC_BASE_URL='${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}' && echo '${btoa(prompt)}' | base64 -d | claude -p --output-format stream-json --verbose --dangerously-skip-permissions ${mcpFlag} ${continueFlag} --model ${model}`;
    },
  },
  cursor: {
    name: "Cursor",
    models: ["auto"],
    apiKeyEnvVar: "CURSOR_AGENT_API_KEY",
    commandTemplate: (prompt, options) => {
      const resumeFlag = options.isFirstMessage ? '' : '--resume=vibracode';
      return `echo '${btoa(prompt)}' | base64 -d | cursor-agent --api-key ${process.env.CURSOR_AGENT_API_KEY} -p --output-format stream-json --force --model auto ${resumeFlag}`;
    },
  },
  gemini: {
    name: "Gemini",
    models: ["default"],
    apiKeyEnvVar: "GEMINI_API_KEY",
    commandTemplate: (prompt, options) => {
      return `export GEMINI_API_KEY='${process.env.GEMINI_API_KEY}' && echo '${btoa(prompt)}' | base64 -d | gemini --output-format stream-json --yolo`;
    },
  },
};
```

### Model Selection

- **Claude**: Configurable via le paramètre `model`
- **Cursor**: Auto selection (`--model auto`)
- **Gemini**: Modèle par défaut

### Continue Mechanism

- **Claude**: `--continue` flag pour continuer une session
- **Cursor**: `--resume=vibracode` flag
- **Gemini**: Pas de continue flag (nouvelle session à chaque fois)

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| Agent Runtime | ✅ | ✅ | ⭐⭐⭐⭐ |
| Tool System | ✅ | ✅ | ⭐⭐⭐⭐ |
| Session System | ✅ | ✅ | ⭐⭐⭐ |
| Execution Provider | ✅ (E2B) | ✅ | ⭐⭐⭐⭐ |
| Context Building | ✅ | ⭐ | ⭐⭐ |
| Streaming | ✅ | ⭐ | ⭐⭐ |
| Error Recovery | ✅ | ⭐ | ⭐ |
| Multi-Provider | ✅ | ✅ | ⭐⭐⭐⭐ |
| Background Jobs | ✅ (Inngest) | ⭐ | ⭐⭐ |
| Realtime | ✅ (Convex) | ⭐ | ⭐⭐ |
| GitHub Integration | ✅ | ✅ | ⭐⭐⭐ |
| Preview System | ✅ | ✅ | ⭐⭐⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| Architecture | Next.js + Convex + Inngest + E2B | Rust Engine + ? | **Adapter** |
| Agent Loop | Inngest Function | ? | **Implémenter** |
| Tool Calling | JSON Stream | ? | **Adapter** |
| Session Management | Convex DB | ? | **Adapter** |
| Execution | E2B Sandbox | ExecutionProvider | **Intégrer** |
| Realtime | Convex Subscriptions | ? | **Adapter** |
| Background Jobs | Inngest | ? | **Adapter** |

### Avantages Vibra à Extraire

1. **Agent Loop Complet**: Le flow complet de l'agent est très bien conçu
2. **Streaming JSON**: Format efficace pour la communication
3. **Error Handling**: Très robuste avec sanitization des secrets
4. **Context Building**: Dynamique et complet
5. **Multi-Provider**: Abstraction propre des providers
6. **Tool Calling**: Intégration transparente des outils
7. **Session Management**: Lifecycle complet et cost tracking

### Points à Améliorer dans SoryOS

1. **Agent Runtime**: Doit devenir un véritable agent avec streaming
2. **Tool System**: Doit supporter le tool calling comme Vibra
3. **Context Engine**: Doit être aussi complet que Vibra
4. **Error Recovery**: Doit être aussi robuste que Vibra
5. **Realtime**: Doit supporter le streaming temps réel
6. **Background Jobs**: Doit gérer les tâches longues

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. Agent Runtime (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/agent/src/runtime.rs

pub struct AgentRuntime {
    session_id: String,
    context: Context,
    provider: AIProvider,
    execution_provider: ExecutionProvider,
    tool_registry: ToolRegistry,
}

impl AgentRuntime {
    pub async fn run(&mut self, message: String) -> Result<AgentResult, AgentError> {
        // 1. Build context
        let context = self.build_context().await?;
        
        // 2. Generate system prompt
        let system_prompt = self.generate_system_prompt(&context);
        
        // 3. Execute AI provider
        let stream = self.provider.execute(message, system_prompt).await?;
        
        // 4. Process stream
        let result = self.process_stream(stream).await?;
        
        // 5. Return result
        Ok(result)
    }
    
    async fn process_stream(&mut self, stream: AIStream) -> Result<AgentResult, AgentError> {
        let mut buffer = String::new();
        let mut result = AgentResult::new();
        
        while let Some(chunk) = stream.next().await {
            buffer.push_str(&chunk);
            
            // Parse complete JSON lines
            let lines: Vec<&str> = buffer.split('\n').collect();
            buffer = lines.last().unwrap_or(&"").to_string();
            
            for line in lines.iter().rev().skip(1) {
                if let Ok(parsed) = serde_json::from_str::<ToolMessage>(line) {
                    match parsed.r#type {
                        "message" => {
                            result.messages.push(Message::from(parsed));
                        }
                        "edit" => {
                            self.execute_edit(&parsed).await?;
                        }
                        "todo" => {
                            result.todos.push(Todo::from(parsed));
                        }
                        "tool_call" => {
                            self.execute_tool(&parsed).await?;
                        }
                        _ => {}
                    }
                }
            }
        }
        
        Ok(result)
    }
    
    async fn execute_tool(&mut self, tool_call: ToolCall) -> Result<(), AgentError> {
        if let Some(tool) = self.tool_registry.get(&tool_call.name) {
            let result = tool.execute(tool_call.arguments).await?;
            // Handle result...
        }
        Ok(())
    }
}
```

#### 2. Context Builder (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/context/src/builder.rs

pub struct ContextBuilder {
    workspace: Workspace,
    session: Session,
    environment: Environment,
    provider: ExecutionProvider,
    git: GitManager,
}

impl ContextBuilder {
    pub async fn build(&self) -> Result<Context, ContextError> {
        let mut context = Context::new();
        
        // Project context
        context.project = self.build_project_context().await?;
        
        // File context
        context.files = self.build_file_context().await?;
        
        // Session context
        context.session = self.build_session_context().await?;
        
        // Environment context
        context.environment = self.build_environment_context().await?;
        
        // Git context
        context.git = self.build_git_context().await?;
        
        // Conversation context
        context.conversation = self.build_conversation_context().await?;
        
        Ok(context)
    }
    
    async fn build_project_context(&self) -> Result<ProjectContext, ContextError> {
        // Lire la structure du projet
        // Détecter les dépendances
        // Lire la configuration
        // ...
    }
    
    async fn build_file_context(&self) -> Result<FileContext, ContextError> {
        // Détecter les fichiers pertinents
        // Lire le contenu des fichiers
        // Extraire les symboles
        // ...
    }
    
    // ... autres méthodes
}
```

#### 3. Tool System (⭐⭐⭐⭐⭐)

**À Étendre**:
```rust
// packages/tools/src/registry.rs

pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    pub fn register(&mut self, name: String, tool: Box<dyn Tool>) {
        self.tools.insert(name, tool);
    }
    
    pub fn get(&self, name: &str) -> Option<&Box<dyn Tool>> {
        self.tools.get(name)
    }
    
    pub fn list(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }
}

pub trait Tool {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn parameters(&self) -> &ToolParameters;
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send>;
}

// Implémentation pour les outils de base
pub struct BashTool;
impl Tool for BashTool {
    fn name(&self) -> &str { "bash" }
    fn description(&self) -> &str { "Execute a shell command" }
    fn parameters(&self) -> &ToolParameters {
        &ToolParameters {
            required: vec!["command"],
            optional: vec![],
            ..Default::default()
        }
    }
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send> {
        let command = args["command"].as_str().unwrap_or("").to_string();
        Box::new(async move {
            let output = self.execution_provider.execute(&command).await?;
            Ok(ToolResult {
                stdout: output.stdout,
                stderr: output.stderr,
                exit_code: output.exit_code,
            })
        })
    }
}
```

#### 4. Streaming Support (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/agent/src/streaming.rs

pub struct AgentStream {
    receiver: mpsc::Receiver<String>,
}

impl Stream for AgentStream {
    type Item = String;
    
    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.receiver.poll_recv(cx)
    }
}

pub trait StreamProcessor {
    fn process(&mut self, chunk: String) -> Result<Vec<ToolMessage>, StreamError>;
}

pub struct JsonStreamProcessor;

impl StreamProcessor for JsonStreamProcessor {
    fn process(&mut self, chunk: String) -> Result<Vec<ToolMessage>, StreamError> {
        let mut buffer = String::new();
        let mut messages = Vec::new();
        
        buffer.push_str(&chunk);
        
        let lines: Vec<&str> = buffer.split('\n').collect();
        buffer = lines.last().unwrap_or(&"").to_string();
        
        for line in lines.iter().rev().skip(1) {
            if !line.trim().is_empty() {
                if let Ok(parsed) = serde_json::from_str::<ToolMessage>(line) {
                    messages.push(parsed);
                }
            }
        }
        
        Ok(messages)
    }
}
```

#### 5. Error Recovery (⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/agent/src/recovery.rs

pub enum AgentError {
    Timeout,
    SandboxTerminated,
    PermissionDenied,
    ParseError(String),
    ExecutionError(String),
    ProviderError(String),
    Unknown(String),
}

pub struct ErrorHandler {
    session_manager: SessionManager,
}

impl ErrorHandler {
    pub async fn handle(&self, error: AgentError, session_id: &str) -> Result<(), ErrorHandlerError> {
        match error {
            AgentError::Timeout => {
                self.handle_timeout(session_id).await?;
            }
            AgentError::SandboxTerminated => {
                self.handle_sandbox_terminated(session_id).await?;
            }
            AgentError::PermissionDenied => {
                self.handle_permission_denied(session_id).await?;
            }
            AgentError::ParseError(msg) => {
                self.handle_parse_error(session_id, &msg).await?;
            }
            AgentError::ExecutionError(msg) => {
                self.handle_execution_error(session_id, &msg).await?;
            }
            AgentError::ProviderError(msg) => {
                self.handle_provider_error(session_id, &msg).await?;
            }
            AgentError::Unknown(msg) => {
                self.handle_unknown_error(session_id, &msg).await?;
            }
        }
        Ok(())
    }
    
    async fn handle_timeout(&self, session_id: &str) -> Result<(), ErrorHandlerError> {
        let message = "⏱️ **Request Timed Out**\n\nThe AI took too long to respond. \n\n**To continue:**\n• Send a new message to resume\n• Try breaking your request into smaller steps\n• Type \"continue\" to pick up from here\n\nYour progress has been saved.";
        self.session_manager.add_message(session_id, message, "assistant").await?;
        self.session_manager.update_status(session_id, SessionStatus::Running).await?;
        Ok(())
    }
    
    // ... autres handlers
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: Fondations (Priorité ⭐⭐⭐⭐⭐)

1. **Créer le ContextBuilder** en Rust
   - Extraire la logique de `lib/prompts.ts`
   - Implémenter toutes les sources de contexte
   - Tester avec des projets réels

2. **Adapter le Session System**
   - Extraire le schema de `convex/schema.ts`
   - Implémenter le lifecycle de session
   - Ajouter le cost tracking

3. **Intégrer E2B dans ExecutionProvider**
   - Extraire `E2BManager` de `lib/e2b/config.ts`
   - Adapter pour notre architecture
   - Tester la création et connexion des sandboxes

### Phase 2: Agent Core (Priorité ⭐⭐⭐⭐⭐)

4. **Implémenter l'Agent Runtime**
   - Extraire le loop de `lib/inngest/functions/run-agent.ts`
   - Implémenter en Rust avec streaming
   - Tester avec des prompts simples

5. **Ajouter le Tool Calling**
   - Extraire les définitions d'outils
   - Étendre le ToolRegistry
   - Tester chaque outil

6. **Ajouter le Streaming Support**
   - Implémenter le JSON stream parser
   - Tester avec des streams réels

### Phase 3: Advanced Features (Priorité ⭐⭐⭐⭐)

7. **Implémenter l'Error Recovery**
   - Extraire les handlers de `onFailure`
   - Implémenter en Rust
   - Tester les différents types d'erreurs

8. **Ajouter le Multi-Provider Support**
   - Extraire les providers de `lib/e2b/config.ts`
   - Adapter pour notre AI Provider system
   - Tester chaque provider

9. **Intégrer le Cost Tracking**
   - Extraire la logique de cost tracking
   - Adapter pour notre système de billing

---

## 📚 RÉFÉRENCES

- [Vibra Code Agent Code](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/run-agent.ts)
- [Vibra Code E2B Config](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/e2b/config.ts)
- [Vibra Code Prompts](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/prompts.ts)
- [Vibra Code Session Schema](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/convex/schema.ts)
- [Claude Code SDK](https://github.com/anthropics/claude-code-sdk)
- [E2B SDK Documentation](https://e2b.dev/docs/sdk)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
