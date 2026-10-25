# Vibra Code - Execution System Analysis

> **Projet**: Extraction du Execution System (E2B) de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [E2B Architecture](#-e2b-architecture)
3. [E2BManager](#-e2bmanager)
4. [Sandbox Lifecycle](#-sandbox-lifecycle)
5. [Command Execution](#-command-execution)
6. [Agent Execution](#-agent-execution)
7. [Template System](#-template-system)
8. [Git Integration](#-git-integration)
9. [Tunnel & Preview](#-tunnel--preview)
10. [Auto-Pause System](#-auto-pause-system)
11. [Error Handling](#-error-handling)
12. [Comparison avec SoryOS](#-comparison-avec-soryos)
13. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture du Execution System

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VIBRA CODE EXECUTION SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   E2B       │    │   SANDBOX   │    │   AGENT     │              │
│  │   SDK       │───►│  MANAGEMENT │───►│  EXECUTION  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    E2BMANAGER CLASS                              │   │
│  │  - createSandbox()                                             │   │
│  │  - connectToSandbox()                                          │   │
│  │  - executeCommand()                                            │   │
│  │  - executeAgent() (Claude/Cursor/Gemini)                       │   │
│  │  - kill() / pause() / resume()                                 │   │
│  │  - getHost() / isRunning()                                     │   │
│  │  - initializeGit() / commitAndPush()                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SANDBOX OPERATIONS                            │   │
│  │  - Sandbox.betaCreate()                                        │   │
│  │  - Sandbox.connect()                                           │   │
│  │  - Sandbox.kill()                                              │   │
│  │  - Sandbox.betaPause()                                         │   │
│  │  - Sandbox.commands.run()                                      │   │
│  │  - Sandbox.getHost()                                           │   │
│  │  - Sandbox.isRunning()                                         │   │
│  │  - Sandbox.files.write/read/list                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    EXECUTION FLOW                               │   │
│  │  1. Create sandbox with template                               │   │
│  │  2. Wait for startup script to finish                          │   │
│  │  3. Generate/inject session token                              │   │
│  │  4. Write .env.local and .expo_env files                       │   │
│  │  5. Connect to sandbox (for existing sessions)                 │   │
│  │  6. Execute commands with streaming                            │   │
│  │  7. Execute agent (Claude/Cursor/Gemini)                       │   │
│  │  8. Handle stdout/stderr streaming                             │   │
│  │  9. Manage auto-pause and timeout                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `lib/e2b/config.ts` | E2BManager + Fonctions d'exécution | ⭐⭐⭐⭐⭐ | 700+ |
| `vibracode-backend/config.ts` | Configuration des templates | ⭐⭐⭐⭐ | 200+ |
| `lib/inngest/functions/create-session.ts` | Création de sandbox | ⭐⭐⭐⭐⭐ | 150+ |
| `lib/inngest/functions/run-agent.ts` | Exécution de l'agent | ⭐⭐⭐⭐⭐ | 1200+ |

---

## 🏗️ E2B ARCHITECTURE

### Concepts de Base

**E2B (E2B.dev)**: Plateforme qui fournit des **sandboxes** isolées et éphémères pour exécuter du code de manière sécurisée.

**Caractéristiques principales**:
- ✅ Sandboxes isolées (Docker-based)
- ✅ Auto-pause après inactivité (15 min par défaut)
- ✅ Streaming stdout/stderr
- ✅ Exécution de commandes
- ✅ Gestion des fichiers
- ✅ Port forwarding (tunnel)
- ✅ Variables d'environnement
- ✅ Templates pré-configurés

### Intégration dans Vibra

Vibra utilise E2B pour:
1. **Créer des sandboxes** pour chaque session
2. **Exécuter des commandes** (npm, git, bash, etc.)
3. **Exécuter des agents IA** (Claude, Cursor, Gemini)
4. **Gérer le filesystem** (lire/écrire des fichiers)
5. **Créer des tunnels** pour le preview
6. **Gérer l'auto-pause** pour économiser les ressources

---

## 🎛️ E2BMANAGER

### Classe E2BManager

**Source**: `lib/e2b/config.ts`

```typescript
export class E2BManager {
  private sandbox: Sandbox | null = null;
  private sandboxId: string | null = null;

  constructor(private config: E2BSandboxConfig = {}) {}

  // Méthodes principales
  async createSandbox(): Promise<Sandbox> { ... }
  async connectToSandbox(sandboxId: string): Promise<Sandbox> { ... }
  async executeCommand(command: string, options: ExecuteOptions): Promise<CommandResult> { ... }
  async executeAgent(prompt: string, agentType: 'claude' | 'cursor' | 'gemini', options: AgentOptions): Promise<CommandResult> { ... }
  async getHost(port: number): Promise<string> { ... }
  async isRunning(): Promise<boolean> { ... }
  async kill(): Promise<void> { ... }
  async pause(): Promise<void> { ... }
  async resume(): Promise<void> { ... }
  getSandboxId(): string | null { ... }
  getSandbox(): Sandbox | null { ... }
  initializeGit(): Promise<void> { ... }
  commitAndPush(githubToken: string, repository: string, commitMessage: string, isInitialPush: boolean): Promise<{ success: boolean; error?: string }> { ... }
}
```

### Configuration

```typescript
export interface E2BSandboxConfig {
  templateId?: string;      // E2B template ID
  apiKey?: string;         // E2B API key (default: process.env.E2B_API_KEY)
  envVars?: Record<string, string>;  // Variables d'environnement
  timeout?: number;        // Timeout auto-pause (default: 15 min)
}
```

### Création de Sandbox

**Source**: `lib/e2b/config.ts` (createE2BSandbox)

```typescript
export async function createE2BSandbox(config: E2BSandboxConfig = {}): Promise<Sandbox> {
  const {
    templateId = "YOUR_E2B_TEMPLATE_ID",
    apiKey = process.env.E2B_API_KEY,
    envVars = {},
    timeout = parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000') // 15 min
  } = config;

  if (!apiKey) {
    throw new Error('E2B_API_KEY environment variable is required');
  }

  console.log(`🟥 Creating E2B sandbox with template: ${templateId} (auto-pause enabled, ${timeout/1000}s timeout from AUTO_PAUSE_TIMEOUT_MS)`);

  // Création avec auto-pause natif
  const sandbox = await Sandbox.betaCreate(templateId, {
    apiKey,
    envs: envVars,
    autoPause: true,
    timeoutMs: timeout
  });

  console.log(`✅ E2B sandbox created with auto-pause: ${sandbox.sandboxId}`);

  // Attendre que le script de démarrage ait fini de générer le session token
  // /vibe0/ est le working directory dans le template E2B
  let sessionToken = '';
  for (let i = 0; i < 25; i++) { // 25 * 200ms = 5s max
    try {
      const result = await sandbox.commands.run('cat /vibe0/.session_token 2>/dev/null');
      sessionToken = result.stdout.trim();
      if (sessionToken && sessionToken.length >= 32) break;
    } catch {}
    await new Promise(r => setTimeout(r, 200)); // Polling rapide
  }

  // Générer un token si nécessaire
  if (!sessionToken || sessionToken.length < 32) {
    console.log('⚠️ Session token not found, generating one...');
    sessionToken = crypto.randomBytes(32).toString('hex');
    await sandbox.files.write('/vibe0/.session_token', sessionToken);
  }

  // Vérifier si startup.sh a déjà écrit les fichiers .env
  let needsEnvWrite = true;
  try {
    const existing = await sandbox.commands.run('cat /vibe0/.env.local 2>/dev/null');
    if (existing.stdout.includes(sandbox.sandboxId) && existing.stdout.includes(sessionToken)) {
      needsEnvWrite = false;
      console.log('📁 Env files already configured by startup script');
    }
  } catch {}

  // Écrire les fichiers .env
  if (needsEnvWrite) {
    const envContent = `EXPO_PUBLIC_PROJECT_ID=${sandbox.sandboxId}\nEXPO_PUBLIC_SESSION_TOKEN=${sessionToken}`;
    const expoEnvContent = `export EXPO_PUBLIC_PROJECT_ID=${sandbox.sandboxId}\nexport EXPO_PUBLIC_SESSION_TOKEN=${sessionToken}`;
    await sandbox.files.write('/vibe0/.env.local', envContent);
    await sandbox.files.write('/vibe0/.expo_env', expoEnvContent);
    console.log(`📁 Injected sandbox ID into .env.local and .expo_env: ${sandbox.sandboxId}`);
  }

  return sandbox;
}
```

### Connexion à une Sandbox Existante

**Source**: `lib/e2b/config.ts` (E2BManager.connectToSandbox)

```typescript
async connectToSandbox(sandboxId: string): Promise<Sandbox> {
  if (this.sandbox && this.sandboxId === sandboxId) {
    console.log('⚠️ Already connected to this sandbox');
    return this.sandbox;
  }

  console.log(`🔄 Connecting to existing sandbox: ${sandboxId}`);

  const { Sandbox } = await import('@e2b/code-interpreter');

  // Connection à la sandbox - auto-resume si paused
  const timeoutMs = parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000');
  this.sandbox = await Sandbox.connect(sandboxId, {
    timeoutMs: timeoutMs
  });

  // Reset explicite du timeout après connexion
  try {
    await this.sandbox.setTimeout(timeoutMs);
    console.log(`⏳ Sandbox timeout reset to ${timeoutMs/1000}s`);
  } catch (timeoutError) {
    console.warn('⚠️ Failed to reset sandbox timeout:', timeoutError);
  }

  this.sandboxId = sandboxId;

  // OPTIMISATION: Skip session token et env file checks on resume
  // Ces fichiers ont déjà été configurés lors de la création initiale
  // Re-vérifier ajoute 3-6 secondes de delay inutile

  console.log(`✅ Connected to sandbox: ${sandboxId}`);
  return this.sandbox;
}
```

---

## 🔄 SANDBOX LIFECYCLE

### Flow Complet

```
CREATION
  │
  ▼
┌─────────────────────┐
│  Sandbox.betaCreate()│  (avec template, envs, autoPause, timeoutMs)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Attendre startup    │  (script génère session token)
│  script             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Vérifier session   │  (cat /vibe0/.session_token)
│  token              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Générer token si    │  (si non trouvé)
│  nécessaire         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Écrire fichiers    │  (.env.local, .expo_env)
│  .env               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandbox prête      │
└──────────┬──────────┘
           │
           ▼
CONNEXION (pour sessions existantes)
  │
  ▼
┌─────────────────────┐
│  Sandbox.connect()   │  (auto-resume si paused)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Reset timeout       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandbox connectée   │
└──────────┬──────────┘
           │
           ▼
EXÉCUTION
  │
  ▼
┌─────────────────────┐
│  sandbox.commands   │  (run, avec streaming)
│  .run()             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Streaming          │  (stdout/stderr)
│  stdout/stderr      │
└──────────┬──────────┘
           │
           ▼
PAUSE (après inactivité)
  │
  ▼
┌─────────────────────┐
│  Sandbox.betaPause()│  (auto-pause après timeout)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandbox paused     │
└──────────┬──────────┘
           │
           ▼
RESUME
  │
  ▼
┌─────────────────────┐
│  Sandbox.connect()   │  (reset timeout)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandbox resumed     │
└──────────┬──────────┘
           │
           ▼
KILL
  │
  ▼
┌─────────────────────┐
│  Sandbox.kill()      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandbox détruite   │
└─────────────────────┘
```

---

## ⚙️ COMMAND EXECUTION

### Fonction executeCommand

**Source**: `lib/e2b/config.ts`

```typescript
export async function executeCommand(
  sandbox: Sandbox,
  command: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    background?: boolean;
    cwd?: string;
    envVars?: Record<string, string>;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  console.log(`🚀 Executing command: ${command.substring(0, 100)}...`);
  console.log(`📁 Working directory: ${options.cwd || 'default'}`);

  // Toujours s'assurer d'être dans le bon dossier
  const finalCommand = options.cwd ? `cd ${options.cwd} && ${command}` : command;
  console.log(`🎯 Final command: ${finalCommand.substring(0, 150)}...`);

  const result = await sandbox.commands.run(finalCommand, {
    onStdout: options.onStdout,
    onStderr: options.onStderr,
    background: options.background || false,
    timeoutMs: 0, // Désactive le timeout pour les commandes longues
    requestTimeoutMs: 900000, // 15 minutes pour le timeout HTTP
    envs: options.envVars
  });

  // Gestion des résultats
  if ('exitCode' in result) {
    // CommandResult
    console.log(`✅ Command completed with exit code: ${result.exitCode}`);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode || 0
    };
  } else {
    // CommandHandle - pour les commandes en arrière-plan
    console.log(`✅ Command started in background with PID: ${(result as any).pid}`);
    return {
      stdout: '',
      stderr: '',
      exitCode: 0
    };
  }
}
```

### E2BManager.executeCommand

```typescript
async executeCommand(
  command: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    background?: boolean;
    cwd?: string;
    envVars?: Record<string, string>;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  if (!this.sandbox) {
    throw new Error('Sandbox not created. Call createSandbox() first.');
  }

  // Default to /vibe0 directory if no cwd specified
  const finalOptions = {
    ...options,
    cwd: options.cwd || '/vibe0'
  };

  return executeCommand(this.sandbox, command, finalOptions);
}
```

---

## 🤖 AGENT EXECUTION

### Exécution des Agents IA

**Source**: `lib/e2b/config.ts`

```typescript
// Claude Agent
export async function executeClaudeAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    isFirstMessage?: boolean;
    model?: string;
    mcpConfig?: Record<string, any>;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  // Modèle par défaut: Opus
  const claudeModel = options.model || 'claude-opus-4-5-20251101';
  
  // Skip --continue flag pour le premier message
  const continueFlag = options.isFirstMessage ? '' : '--continue';
  
  // Base64 encoding pour éviter les problèmes de shell escaping
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');

  // Configuration MCP si fournie
  let mcpFlag = '';
  if (options.mcpConfig && Object.keys(options.mcpConfig).length > 0) {
    const mcpConfigJson = JSON.stringify(options.mcpConfig);
    const mcpConfigBase64 = Buffer.from(mcpConfigJson, 'utf8').toString('base64');
    mcpFlag = `--mcp-config "$(echo '${mcpConfigBase64}' | base64 -d)"`;
  }

  const anthropicKey = process.env.ANTHROPIC_SANDBOX_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  
  if (!anthropicKey) throw new Error('ANTHROPIC_SANDBOX_API_KEY environment variable is required');
  
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

// Cursor Agent
export async function executeCursorAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    isFirstMessage?: boolean;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
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

// Gemini Agent
export async function executeGeminiAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
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

// Méthode unifiée dans E2BManager
async executeAgent(
  prompt: string,
  agentType: 'claude' | 'cursor' | 'gemini' = 'claude',
  options: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    isFirstMessage?: boolean;
    model?: string;
    mcpConfig?: Record<string, any>;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  if (!this.sandbox) {
    throw new Error('Sandbox not created. Call createSandbox() first.');
  }

  if (agentType === 'claude') {
    return executeClaudeAgent(this.sandbox, prompt, options);
  } else if (agentType === 'gemini') {
    return executeGeminiAgent(this.sandbox, prompt, options);
  } else {
    return executeCursorAgent(this.sandbox, prompt, options);
  }
}
```

---

## 📁 TEMPLATE SYSTEM

### Configuration des Templates

**Source**: `vibracode-backend/config.ts`

```typescript
export interface Template {
  id: string;
  name: string;
  description: string;
  image: string;           // E2B template ID
  secrets: Record<string, string>;  // Variables d'environnement par défaut
  startCommands: Array<{
    command: string;
    status: string;
    background: boolean;
  }>;
}

export const templates: Template[] = [
  {
    id: "blank",
    name: "Blank App",
    description: "Start from scratch with a blank Expo app",
    image: "e2b-template-blank-expo",
    secrets: {},
    startCommands: [
      {
        command: "npx expo start --tunnel --port 3000",
        status: "Starting dev server",
        background: true
      }
    ]
  },
  {
    id: "react-native",
    name: "React Native",
    description: "React Native template with common dependencies",
    image: "e2b-template-react-native",
    secrets: {},
    startCommands: [
      {
        command: "npm install",
        status: "Installing dependencies",
        background: false
      },
      {
        command: "npx expo start --tunnel --port 3000",
        status: "Starting dev server",
        background: true
      }
    ]
  },
  {
    id: "nextjs",
    name: "Next.js",
    description: "Next.js template",
    image: "e2b-template-nextjs",
    secrets: {},
    startCommands: [
      {
        command: "npm install",
        status: "Installing dependencies",
        background: false
      },
      {
        command: "npx next dev --port 3000",
        status: "Starting dev server",
        background: true
      }
    ]
  }
];
```

### Utilisation des Templates

```typescript
// Dans create-session.ts
const template = templates.find((t) => t.id === templateId);
if (!template) {
  throw new Error(`Template with id "${templateId}" not found`);
}

const e2bManager = new E2BManager({
  templateId: template.image,
  envVars: template.secrets
});

// Exécution des commandes de démarrage
for await (const command of template.startCommands) {
  await updateSessionStatus(id, command.status);
  await e2bManager.executeCommand(command.command, {
    background: command.background,
  });
}
```

---

## 🔗 GIT INTEGRATION

### Initialisation Git

**Source**: `lib/e2b/config.ts` (E2BManager.initializeGit)

```typescript
async initializeGit(): Promise<void> {
  if (!this.sandbox) {
    throw new Error('Sandbox not created. Call createSandbox() first.');
  }

  console.log('📁 Initializing git repository...');

  // Script atomique pour s'assurer que l'état persiste
  // Suppression du .git existant pour éviter l'historique ancien
  const initScript = `
    cd /vibe0
    rm -rf .wh..git .wh.* 2>/dev/null || true
    rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
    git config --global --add safe.directory /vibe0
    git config --global user.email "vibracode@app.com"
    git config --global user.name "Vibra Code"
    git config --global init.defaultBranch main
    git init
    echo "Git initialized successfully"
  `;

  await executeCommand(this.sandbox, initScript, { cwd: '/vibe0' });

  console.log('✅ Git repository initialized');
}
```

### Commit & Push

**Source**: `lib/e2b/config.ts` (E2BManager.commitAndPush)

```typescript
async commitAndPush(
  githubToken: string,
  repository: string,
  commitMessage: string,
  isInitialPush: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (!this.sandbox) {
    throw new Error('Sandbox not created');
  }

  try {
    console.log(`🚀 Pushing to GitHub: ${repository} (isInitialPush: ${isInitialPush})`);

    // URL du remote avec authentification
    const remoteUrl = `https://${githubToken}@github.com/${repository}.git`;
    const escapedMessage = commitMessage.replace(/"/g, '\\"').replace(/\$/g, '\\$');

    // Génération du contenu README
    const repoName = repository.split('/')[1] || repository;
    const readmeContent = `# ${repoName}

> Mobile app built with Vibra Code

[![Download on the App Store](https://img.shields.io/badge/Download-App%20Store-blue?logo=apple&logoColor=white)](https://apps.apple.com/us/app/vibra-code-ai-app-builder/id6752743077)
`;

    let pushScript: string;

    if (isInitialPush) {
      // Initial push: suppression du .git, init frais, ajout README, force push
      pushScript = `
        cd /vibe0
        rm -rf .wh..git .wh.* 2>/dev/null || true
        rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
        
        cat > README.md << 'READMEEOF'
${readmeContent}
READMEEOF
        
        git config --global --add safe.directory /vibe0
        git config --global user.email "vibracode@app.com"
        git config --global user.name "Vibra Code"
        git config --global init.defaultBranch main
        git init
        
        echo '.wh.*' >> .gitignore
        echo 'node_modules/' >> .gitignore
        echo '.env.local' >> .gitignore
        
        git remote add origin "${remoteUrl}"
        git add .
        git commit -m "${escapedMessage}"
        git push -u origin main --force 2>&1
      `;
    } else {
      // Push ultérieur: préservation de l'historique git
      pushScript = `
        cd /vibe0
        rm -rf .wh..git .wh.* 2>/dev/null || true
        rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
        
        if [ ! -f "README.md" ]; then
          cat > README.md << 'READMEEOF'
${readmeContent}
READMEEOF
        fi
        
        git config --global --add safe.directory /vibe0
        git config --global user.email "vibracode@app.com"
        git config --global user.name "Vibra Code"
        git config --global init.defaultBranch main
        
        git init
        
        echo '.wh.*' >> .gitignore
        echo 'node_modules/' >> .gitignore
        echo '.env.local' >> .gitignore
        
        git remote add origin "${remoteUrl}"
        
        git fetch origin main 2>/dev/null || true
        git reset origin/main 2>/dev/null || true
        
        git add .
        git commit -m "${escapedMessage}"
        
        git push origin main 2>&1 || git push origin main --force 2>&1
      `;
    }

    const result = await this.sandbox.commands.run(pushScript, {
      timeoutMs: 120000, // 2 minutes timeout
    });

    // Vérification du succès
    const output = result.stdout + result.stderr;
    const isSuccess = result.exitCode === 0 ||
      output.includes('-> main') ||
      output.includes('Everything up-to-date') ||
      output.includes('Nothing to commit') ||
      output.includes('Push completed');

    if (!isSuccess) {
      return { success: false, error: result.stderr || result.stdout || 'Push failed' };
    }

    console.log('✅ Successfully pushed to GitHub');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Git push error:', error);
    const errorMessage = error.result?.stderr || error.result?.stdout || error.message || 'Unknown error';
    
    // Vérification si c'est un succès (déjà à jour)
    if (errorMessage.includes('nothing to commit') ||
        errorMessage.includes('Everything up-to-date') ||
        errorMessage.includes('-> main')) {
      console.log('✅ Already up to date, treating as success');
      return { success: true };
    }

    return { success: false, error: errorMessage };
  }
}
```

---

## 🌐 TUNNEL & PREVIEW

### Obtention de l'Host

**Source**: `lib/e2b/config.ts`

```typescript
// Fonction utilitaire
export async function getSandboxHost(sandbox: Sandbox, port: number): Promise<string> {
  const host = await sandbox.getHost(port);
  // E2B getHost retourne juste le hostname, il faut ajouter https://
  return `https://${host}`;
}

// Méthode dans E2BManager
async getHost(port: number): Promise<string> {
  if (!this.sandbox) {
    throw new Error('Sandbox not created. Call createSandbox() first.');
  }

  return getSandboxHost(this.sandbox, port);
}
```

### Création du Tunnel

Dans Vibra, le tunnel est créé automatiquement via Expo:

```typescript
// Dans create-session.ts
await e2bManager.executeCommand("npx expo start --tunnel --port 3000", {
  background: true,
});

// Puis obtention de l'URL
await updateSessionStatus(id, "CREATING_TUNNEL");
const host = await e2bManager.getHost(3000);
```

Le tunnel Expo crée automatiquement une URL publique vers le serveur de dev.

---

## ⏳ AUTO-PAUSE SYSTEM

### Mécanisme d'Auto-Pause

E2B supporte l'**auto-pause** natif:

```typescript
// Configuration lors de la création
await Sandbox.betaCreate(templateId, {
  apiKey,
  envs: envVars,
  autoPause: true,        // Active l'auto-pause
  timeoutMs: 900000       // 15 minutes de timeout
});
```

### Reset du Timeout

```typescript
// Lors de la connexion à une sandbox existante
this.sandbox = await Sandbox.connect(sandboxId, {
  timeoutMs: timeoutMs
});

// Reset explicite du timeout
await this.sandbox.setTimeout(timeoutMs);
```

### Gestion dans Vibra

```typescript
// Dans createE2BSandbox
const timeout = parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000'); // 15 min

// Dans connectToSandbox
const timeoutMs = parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000');
this.sandbox = await Sandbox.connect(sandboxId, {
  timeoutMs: timeoutMs
});

// Reset du timeout après connexion
try {
  await this.sandbox.setTimeout(timeoutMs);
  console.log(`⏳ Sandbox timeout reset to ${timeoutMs/1000}s`);
} catch (timeoutError) {
  console.warn('⚠️ Failed to reset sandbox timeout:', timeoutError);
}
```

---

## 🚨 ERROR HANDLING

### Gestion des Erreurs Sandbox

```typescript
// Vérification si la sandbox est en cours d'exécution
export async function isSandboxRunning(sandbox: Sandbox): Promise<boolean> {
  try {
    return await sandbox.isRunning();
  } catch (error) {
    console.error('Error checking sandbox status:', error);
    return false;
  }
}

// Destruction de la sandbox
export async function killSandbox(sandbox: Sandbox): Promise<void> {
  console.log(`❌ Killing sandbox: ${sandbox.sandboxId}`);
  await sandbox.kill();
  console.log(`✅ Sandbox killed: ${sandbox.sandboxId}`);
}

// Dans E2BManager
async kill(): Promise<void> {
  if (this.sandbox) {
    await killSandbox(this.sandbox);
    this.sandbox = null;
    this.sandboxId = null;
  }
}

async pause(): Promise<void> {
  if (this.sandbox) {
    console.log(`⏸️ Pausing sandbox: ${this.sandboxId}`);
    await this.sandbox.betaPause();
    console.log(`✅ Sandbox paused: ${this.sandboxId}`);
  }
}

async resume(): Promise<void> {
  if (this.sandbox) {
    console.log(`▶️ Resuming sandbox: ${this.sandboxId}`);
    this.sandbox = await this.sandbox.connect({ timeoutMs: parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000') });
    console.log(`✅ Sandbox resumed: ${this.sandboxId}`);
  }
}
```

### Détection des Erreurs dans run-agent

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
                      errorMessage.includes('timed out') ||
                      errorMessage.includes('ETIMEDOUT') ||
                      errorMessage.includes('deadline exceeded');

    // 2. Sandbox Terminated
    const isSandboxTerminated = errorMessage.includes('terminated') ||
                                errorMessage.includes('[unknown]') ||
                                errorMessage.includes('SandboxError') ||
                                errorMessage.includes('unavailable') ||
                                errorMessage.includes('sandbox not found');

    // Reset du statut de la session
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

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| E2B Integration | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Sandbox Management | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Command Execution | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Agent Execution | ✅ | ⭐ | ⭐⭐ |
| Template System | ✅ | ⭐ | ⭐ |
| Git Integration | ✅ | ✅ | ⭐⭐⭐⭐ |
| Tunnel/Preview | ✅ | ✅ | ⭐⭐⭐ |
| Auto-Pause | ✅ | ⭐ | ⭐ |
| Error Handling | ✅ | ✅ | ⭐⭐⭐⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| E2BManager | Classe complète | À adapter | **Adapter** |
| Sandbox Lifecycle | Complet (create, connect, pause, resume, kill) | Partiel | **Compléter** |
| Agent Execution | Multi-provider (Claude/Cursor/Gemini) | À implémenter | **Implémenter** |
| Template System | Configurable | À implémenter | **Implémenter** |
| Auto-Pause | Natif E2B | À adapter | **Adapter** |
| Base64 Encoding | Pour sécurité | À adopter | **Adopter** |

### Avantages Vibra à Extraire

1. **E2BManager Class**: Classe complète pour gérer les sandboxes
2. **Sandbox Lifecycle**: Flow complet de création à destruction
3. **Multi-Agent Execution**: Support de Claude, Cursor, Gemini
4. **Template System**: Templates pré-configurés avec start commands
5. **Auto-Pause**: Gestion native de l'auto-pause E2B
6. **Base64 Encoding**: Sécurité pour les prompts avec caractères spéciaux
7. **Error Recovery**: Gestion robuste des erreurs sandbox
8. **Git Integration**: Initialisation git et commit/push complets

### Points à Améliorer dans SoryOS

1. **E2B Integration**: Doit être aussi complète que Vibra
2. **Sandbox Management**: Doit supporter tout le lifecycle
3. **Agent Execution**: Doit supporter multi-provider
4. **Template System**: Doit être configurable
5. **Auto-Pause**: Doit utiliser l'auto-pause natif E2B

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. E2B Execution Provider (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/execution/src/e2b.rs

use std::collections::HashMap;
use std::sync::Arc;
use async_trait::async_trait;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct E2BConfig {
    pub template_id: Option<String>,
    pub api_key: Option<String>,
    pub env_vars: HashMap<String, String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone)]
pub struct E2BSandbox {
    pub sandbox_id: String,
    pub host: Option<String>,
    pub is_running: bool,
    pub template_id: String,
}

#[async_trait]
pub trait E2BProvider: Send + Sync {
    async fn create_sandbox(&self, config: &E2BConfig) -> Result<E2BSandbox, ExecutionError>;
    async fn connect_to_sandbox(&self, sandbox_id: &str) -> Result<E2BSandbox, ExecutionError>;
    async fn execute(&self, sandbox_id: &str, command: &str, options: &ExecuteOptions) -> Result<CommandResult, ExecutionError>;
    async fn execute_agent(&self, sandbox_id: &str, prompt: &str, agent_type: &str, options: &AgentOptions) -> Result<CommandResult, ExecutionError>;
    async fn get_host(&self, sandbox_id: &str, port: u16) -> Result<String, ExecutionError>;
    async fn is_running(&self, sandbox_id: &str) -> Result<bool, ExecutionError>;
    async fn kill(&self, sandbox_id: &str) -> Result<(), ExecutionError>;
    async fn pause(&self, sandbox_id: &str) -> Result<(), ExecutionError>;
    async fn resume(&self, sandbox_id: &str) -> Result<(), ExecutionError>;
    async fn initialize_git(&self, sandbox_id: &str) -> Result<(), ExecutionError>;
    async fn commit_and_push(&self, sandbox_id: &str, github_token: &str, repository: &str, message: &str, is_initial: bool) -> Result<GitPushResult, ExecutionError>;
}

#[derive(Debug, Clone)]
pub struct E2BExecutionProvider {
    client: Arc<dyn E2BClient>,
    sandboxes: Arc<RwLock<HashMap<String, E2BSandbox>>>,
    config: E2BConfig,
}

#[async_trait]
impl E2BProvider for E2BExecutionProvider {
    async fn create_sandbox(&self, config: &E2BConfig) -> Result<E2BSandbox, ExecutionError> {
        let template_id = config.template_id.as_deref().unwrap_or("default");
        let api_key = config.api_key.as_deref().unwrap_or(
            std::env::var("E2B_API_KEY").map_err(|_| ExecutionError::MissingApiKey)?
        );
        
        // Appel à l'API E2B
        let sandbox = self.client.create_sandbox(&CreateSandboxRequest {
            template_id: template_id.to_string(),
            api_key: api_key.to_string(),
            env_vars: config.env_vars.clone(),
            auto_pause: true,
            timeout_ms: config.timeout_ms,
        }).await?;
        
        // Attendre le session token
        let session_token = self.wait_for_session_token(&sandbox.sandbox_id).await?;
        
        // Écrire les fichiers .env
        self.write_env_files(&sandbox.sandbox_id, &session_token, &config.env_vars).await?;
        
        let mut sandbox_state = E2BSandbox {
            sandbox_id: sandbox.sandbox_id.clone(),
            host: None,
            is_running: true,
            template_id: template_id.to_string(),
        };
        
        // Stocker la sandbox
        self.sandboxes.write().await.insert(sandbox.sandbox_id.clone(), sandbox_state.clone());
        
        Ok(sandbox_state)
    }
    
    async fn connect_to_sandbox(&self, sandbox_id: &str) -> Result<E2BSandbox, ExecutionError> {
        // Vérifier si déjà connecté
        if let Some(sandbox) = self.sandboxes.read().await.get(sandbox_id) {
            if sandbox.is_running {
                return Ok(sandbox.clone());
            }
        }
        
        // Connection via API E2B
        let sandbox = self.client.connect_to_sandbox(sandbox_id).await?;
        
        // Reset du timeout
        self.client.set_timeout(sandbox_id, self.config.timeout_ms).await?;
        
        let mut sandbox_state = E2BSandbox {
            sandbox_id: sandbox.sandbox_id.clone(),
            host: None,
            is_running: true,
            template_id: sandbox.template_id.clone(),
        };
        
        // Stocker la sandbox
        self.sandboxes.write().await.insert(sandbox.sandbox_id.clone(), sandbox_state.clone());
        
        Ok(sandbox_state)
    }
    
    async fn execute(&self, sandbox_id: &str, command: &str, options: &ExecuteOptions) -> Result<CommandResult, ExecutionError> {
        let sandbox = self.connect_to_sandbox(sandbox_id).await?;
        
        // Construction de la commande finale
        let final_command = if let Some(cwd) = &options.cwd {
            format!("cd {} && {}", cwd, command)
        } else {
            command.to_string()
        };
        
        // Exécution via API E2B
        let result = self.client.execute_command(&ExecuteCommandRequest {
            sandbox_id: sandbox_id.to_string(),
            command: final_command,
            on_stdout: options.on_stdout.clone(),
            on_stderr: options.on_stderr.clone(),
            background: options.background,
            timeout_ms: options.timeout_ms,
            env_vars: options.env_vars.clone(),
        }).await?;
        
        Ok(CommandResult {
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
        })
    }
    
    async fn execute_agent(&self, sandbox_id: &str, prompt: &str, agent_type: &str, options: &AgentOptions) -> Result<CommandResult, ExecutionError> {
        let sandbox = self.connect_to_sandbox(sandbox_id).await?;
        
        // Base64 encoding du prompt
        let prompt_base64 = base64::encode(prompt);
        
        // Construction de la commande selon l'agent
        let command = match agent_type {
            "claude" => self.build_claude_command(&prompt_base64, options)?,
            "cursor" => self.build_cursor_command(&prompt_base64, options)?,
            "gemini" => self.build_gemini_command(&prompt_base64, options)?,
            _ => return Err(ExecutionError::UnknownAgent(agent_type.to_string())),
        };
        
        // Exécution
        let result = self.execute(sandbox_id, &command, &ExecuteOptions {
            cwd: Some("/vibe0".to_string()),
            on_stdout: options.on_stdout.clone(),
            on_stderr: options.on_stderr.clone(),
            background: false,
            timeout_ms: 0,
            env_vars: HashMap::new(),
        }).await?;
        
        Ok(result)
    }
    
    fn build_claude_command(&self, prompt_base64: &str, options: &AgentOptions) -> Result<String, ExecutionError> {
        let model = options.model.as_deref().unwrap_or("claude-opus-4-5-20251101");
        let continue_flag = if options.is_first_message { "" } else { "--continue" };
        let mcp_flag = if let Some(mcp_config) = &options.mcp_config {
            let mcp_json = serde_json::to_string(mcp_config)?;
            let mcp_base64 = base64::encode(&mcp_json);
            format!("--mcp-config \"$(echo '{}' | base64 -d)\"", mcp_base64)
        } else {
            String::new()
        };
        
        let api_key = std::env::var("ANTHROPIC_SANDBOX_API_KEY").map_err(|_| ExecutionError::MissingApiKey)?;
        let base_url = std::env::var("ANTHROPIC_BASE_URL").unwrap_or_else(|_| "https://api.anthropic.com".to_string());
        
        Ok(format!(
            "export ANTHROPIC_API_KEY='{}' && export ANTHROPIC_BASE_URL='{}' && echo '{}' | base64 -d | claude -p --output-format stream-json --verbose --dangerously-skip-permissions {} {} --model {}",
            api_key, base_url, prompt_base64, mcp_flag, continue_flag, model
        ))
    }
    
    // ... autres méthodes build_*
    
    async fn get_host(&self, sandbox_id: &str, port: u16) -> Result<String, ExecutionError> {
        let host = self.client.get_host(sandbox_id, port).await?;
        Ok(format!("https://{}", host))
    }
    
    async fn is_running(&self, sandbox_id: &str) -> Result<bool, ExecutionError> {
        self.client.is_running(sandbox_id).await
    }
    
    async fn kill(&self, sandbox_id: &str) -> Result<(), ExecutionError> {
        self.client.kill_sandbox(sandbox_id).await?;
        self.sandboxes.write().await.remove(sandbox_id);
        Ok(())
    }
    
    async fn pause(&self, sandbox_id: &str) -> Result<(), ExecutionError> {
        self.client.pause_sandbox(sandbox_id).await
    }
    
    async fn resume(&self, sandbox_id: &str) -> Result<(), ExecutionError> {
        self.client.resume_sandbox(sandbox_id).await?;
        self.client.set_timeout(sandbox_id, self.config.timeout_ms).await?;
        Ok(())
    }
    
    async fn initialize_git(&self, sandbox_id: &str) -> Result<(), ExecutionError> {
        let script = r#"
            cd /vibe0
            rm -rf .wh..git .wh.* 2>/dev/null || true
            rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
            git config --global --add safe.directory /vibe0
            git config --global user.email "soryos@app.com"
            git config --global user.name "SoryOS"
            git config --global init.defaultBranch main
            git init
        "#;
        
        self.execute(sandbox_id, script, &ExecuteOptions::default()).await?;
        Ok(())
    }
    
    async fn commit_and_push(&self, sandbox_id: &str, github_token: &str, repository: &str, message: &str, is_initial: bool) -> Result<GitPushResult, ExecutionError> {
        // Implémentation similaire à Vibra
        // ...
    }
    
    async fn wait_for_session_token(&self, sandbox_id: &str) -> Result<String, ExecutionError> {
        // Polling pour récupérer le session token
        for _ in 0..25 {
            if let Ok(result) = self.execute(sandbox_id, "cat /vibe0/.session_token 2>/dev/null", &ExecuteOptions::default()).await {
                let token = result.stdout.trim();
                if !token.is_empty() && token.len() >= 32 {
                    return Ok(token);
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
        
        // Générer un token si non trouvé
        let token = uuid::Uuid::new_v4().to_string();
        self.execute(sandbox_id, &format!("echo '{}' > /vibe0/.session_token", token), &ExecuteOptions::default()).await?;
        Ok(token)
    }
    
    async fn write_env_files(&self, sandbox_id: &str, session_token: &str, env_vars: &HashMap<String, String>) -> Result<(), ExecutionError> {
        let mut env_content = format!("EXPO_PUBLIC_PROJECT_ID={}\nEXPO_PUBLIC_SESSION_TOKEN={}", sandbox_id, session_token);
        
        for (key, value) in env_vars {
            env_content.push_str(&format!("\n{}={}", key, value));
        }
        
        self.execute(sandbox_id, &format!("echo '{}' > /vibe0/.env.local", env_content), &ExecuteOptions::default()).await?;
        
        let expo_env_content = env_content.lines().map(|line| format!("export {}", line)).collect::<Vec<_>>().join("\n");
        self.execute(sandbox_id, &format!("echo '{}' > /vibe0/.expo_env", expo_env_content), &ExecuteOptions::default()).await?;
        
        Ok(())
    }
}
```

#### 2. Template System (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/execution/src/templates.rs

use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub description: String,
    pub image: String, // E2B template ID
    pub secrets: HashMap<String, String>,
    pub start_commands: Vec<StartCommand>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StartCommand {
    pub command: String,
    pub status: String,
    pub background: bool,
}

pub struct TemplateManager {
    templates: HashMap<String, Template>,
}

impl TemplateManager {
    pub fn new() -> Self {
        let mut manager = Self {
            templates: HashMap::new(),
        };
        
        manager.register_default_templates();
        manager
    }
    
    pub fn register_default_templates(&mut self) {
        let templates = vec![
            Template {
                id: "blank".to_string(),
                name: "Blank App".to_string(),
                description: "Start from scratch with a blank Expo app".to_string(),
                image: "e2b-template-blank-expo".to_string(),
                secrets: HashMap::new(),
                start_commands: vec![
                    StartCommand {
                        command: "npx expo start --tunnel --port 3000".to_string(),
                        status: "Starting dev server".to_string(),
                        background: true,
                    }
                ],
            },
            Template {
                id: "react-native".to_string(),
                name: "React Native".to_string(),
                description: "React Native template with common dependencies".to_string(),
                image: "e2b-template-react-native".to_string(),
                secrets: HashMap::new(),
                start_commands: vec![
                    StartCommand {
                        command: "npm install".to_string(),
                        status: "Installing dependencies".to_string(),
                        background: false,
                    },
                    StartCommand {
                        command: "npx expo start --tunnel --port 3000".to_string(),
                        status: "Starting dev server".to_string(),
                        background: true,
                    }
                ],
            },
            // ... autres templates
        ];
        
        for template in templates {
            self.templates.insert(template.id.clone(), template);
        }
    }
    
    pub fn get(&self, id: &str) -> Option<&Template> {
        self.templates.get(id)
    }
    
    pub fn list(&self) -> Vec<&Template> {
        self.templates.values().collect()
    }
    
    pub fn register(&mut self, template: Template) {
        self.templates.insert(template.id.clone(), template);
    }
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: E2B Integration Foundation (Priorité ⭐⭐⭐⭐⭐)

1. **Créer le E2B Client**
   - Créer `packages/execution/src/e2b/client.rs`
   - Implémenter les appels API E2B
   - Tester avec des requêtes réelles

2. **Créer le E2B Execution Provider**
   - Créer `packages/execution/src/e2b.rs`
   - Implémenter E2BProvider trait
   - Tester la création et connexion des sandboxes

3. **Intégrer avec ExecutionProvider**
   - Adapter ExecutionProvider pour utiliser E2B
   - Tester l'exécution de commandes

### Phase 2: Agent Execution (Priorité ⭐⭐⭐⭐⭐)

4. **Implémenter l'exécution des agents**
   - Ajouter execute_agent au E2BProvider
   - Implémenter Claude, Cursor, Gemini
   - Tester chaque provider

5. **Ajouter le Base64 Encoding**
   - Utiliser base64 pour les prompts
   - Tester avec des prompts complexes

### Phase 3: Advanced Features (Priorité ⭐⭐⭐⭐)

6. **Implémenter le Template System**
   - Créer `packages/execution/src/templates.rs`
   - Définir les templates par défaut
   - Tester la création avec templates

7. **Ajouter la Git Integration**
   - Implémenter initialize_git
   - Implémenter commit_and_push
   - Tester avec GitHub

8. **Ajouter l'Auto-Pause**
   - Configurer auto_pause et timeout_ms
   - Tester le comportement après inactivité

---

## 📚 RÉFÉRENCES

- [E2B SDK Documentation](https://e2b.dev/docs/sdk)
- [Vibra Code E2B Config](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/e2b/config.ts)
- [Vibra Code Create Session](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/create-session.ts)
- [Vibra Code Run Agent](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/run-agent.ts)
- [E2B Templates](https://e2b.dev/docs/templates)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
