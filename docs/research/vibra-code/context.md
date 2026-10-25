# Vibra Code - Context Engine Analysis

> **Projet**: Extraction du Context Engine de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [Context Architecture](#-context-architecture)
3. [Context Sources](#-context-sources)
4. [Context Building](#-context-building)
5. [System Prompt Generation](#-system-prompt-generation)
6. [Context Types](#-context-types)
7. [Relevant Files Detection](#-relevant-files-detection)
8. [Project Analysis](#-project-analysis)
9. [Comparison avec SoryOS](#-comparison-avec-soryos)
10. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture du Context Engine

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VIBRA CODE CONTEXT ENGINE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │  CONVEX DB  │    │   E2B       │    │  GITHUB     │              │
│  │  (Sessions, │    │  SANDBOX    │    │  API        │              │
│  │   Messages, │    │             │    │             │              │
│  │   Users)    │    │             │    │             │              │
│  └──────────┬──────────┘    └──────────┬──────────┘    └──────────┬────┘ │
│           │                  │                     │              │
│           ▼                  ▼                     ▼              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    CONTEXT BUILDER                             │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │   │
│  │  │ PROJECT     │    │  FILE       │    │  SESSION    │        │   │
│  │  │ CONTEXT     │    │  CONTEXT     │    │  CONTEXT     │        │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘        │   │
│  │                                                                      │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │   │
│  │  │ ENVIRONMENT │    │  GIT        │    │  CONVERSATION│        │   │
│  │  │ CONTEXT     │    │  CONTEXT     │    │  CONTEXT     │        │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SYSTEM PROMPT                                  │   │
│  │  (Dynamic generation based on all contexts)                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    AI PROVIDER INPUT                             │   │
│  │  (System prompt + user message + context)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `lib/prompts.ts` | Génération des prompts système | ⭐⭐⭐⭐⭐ | 600+ |
| `lib/inngest/functions/run-agent.ts` | Context building | ⭐⭐⭐⭐⭐ | 1200+ |
| `convex/sessions.ts` | Session context | ⭐⭐⭐⭐ | 300+ |
| `convex/schema.ts` | Database schema | ⭐⭐⭐⭐ | 500+ |

---

## 🏗️ CONTEXT ARCHITECTURE

### Concepts de Base

Dans Vibra Code, le **context** est construit dynamiquement à partir de multiples sources:

1. **Convex Database**: Sessions, messages, users, costs
2. **E2B Sandbox**: Filesystem, process list, env vars, working directory
3. **GitHub API**: Repository info, PR status, branch info
4. **Template Config**: Start commands, secrets, image info
5. **Previous Messages**: Historique de la conversation
6. **Tool Results**: Résultats des outils précédents
7. **Errors**: Erreurs rencontrées

### ContextBuilder Conceptuel

Bien que Vibra n'ait pas de classe `ContextBuilder` explicite, la logique est répartie:

- **`getSessionData()`**: Récupère les données de session depuis Convex
- **`getSessionMessages()`**: Récupère l'historique des messages
- **`getSystemPrompt()`**: Génère le prompt système avec le contexte
- **`E2BManager`**: Fournit l'accès au filesystem et env vars

---

## 📡 CONTEXT SOURCES

### 1. Project Context (⭐⭐⭐⭐⭐)

**Source**: E2B Sandbox Filesystem

**Données Collectées**:
- Structure du projet (arbre des fichiers/dossiers)
- Contenu des fichiers
- Dependencies (package.json, yarn.lock, pnpm-lock.yaml)
- Configuration (tsconfig.json, .eslintrc, etc.)
- Template utilisé (blank, react-native, nextjs, etc.)
- Working directory (généralement `/vibe0`)

**Exemple**:
```typescript
// Dans lib/prompts.ts
const projectContext = {
  cwd: '/vibe0',
  structure: await getProjectStructure('/vibe0'),
  dependencies: await getDependencies('/vibe0/package.json'),
  config: await getConfig('/vibe0'),
  template: session.templateId,
};
```

### 2. File Context (⭐⭐⭐⭐⭐)

**Source**: E2B Sandbox Filesystem + Session State

**Données Collectées**:
- Fichier actuel ouvert (si applicable)
- Fichiers pertinents (relevant files)
- Symboles et définitions (pour le code)
- Contenu des fichiers
- Modifications récentes

**Relevant Files Detection**:
```typescript
// Algorithme de détection des fichiers pertinents
const getRelevantFiles = async (sessionId: string, message: string): Promise<RelevantFile[]> => {
  const session = await getSessionData(sessionId);
  const recentFiles = await getRecentlyModifiedFiles(sessionId);
  const mentionedFiles = extractFilePathsFromMessage(message);
  const openFiles = await getOpenFiles(sessionId);
  
  // Combinaison et déduplication
  const allFiles = [...recentFiles, ...mentionedFiles, ...openFiles];
  const uniqueFiles = Array.from(new Set(allFiles.map(f => f.path)))
    .map(path => allFiles.find(f => f.path === path));
  
  // Limite à 20 fichiers pour éviter de surcharger le contexte
  return uniqueFiles.slice(0, 20);
};
```

### 3. Session Context (⭐⭐⭐⭐⭐)

**Source**: Convex Database

**Données Collectées**:
- Session ID (E2B sandbox ID)
- Session DB ID (Convex ID)
- Session name
- Session status (RUNNING, CUSTOM, etc.)
- Session statusMessage
- Template ID
- Tunnel URL (preview)
- GitHub repository
- GitHub push status
- Environment variables
- Total cost
- Message count
- Agent stopped flag

**Exemple**:
```typescript
// Dans lib/inngest/functions/run-agent.ts
const sessionData = await getSessionData(id);

const sessionContext = {
  sessionId: sessionData.sessionId,
  sessionDbId: sessionData._id,
  name: sessionData.name,
  status: sessionData.status,
  statusMessage: sessionData.statusMessage,
  templateId: sessionData.templateId,
  tunnelUrl: sessionData.tunnelUrl,
  githubRepository: sessionData.githubRepository,
  envs: sessionData.envs || {},
  totalCost: sessionData.totalCostUSD || 0,
  messageCount: sessionData.messageCount || 0,
  agentStopped: sessionData.agentStopped || false,
};
```

### 4. Environment Context (⭐⭐⭐⭐)

**Source**: E2B Sandbox + Session Envs

**Données Collectées**:
- Sandbox ID
- Working directory
- Session token
- Environment variables (process.env + session.envs)
- Node.js version
- npm/yarn/pnpm availability
- Git configuration
- Expo CLI availability

**Exemple**:
```typescript
const envContext = {
  sandboxId: sandbox.sandboxId,
  cwd: '/vibe0',
  sessionToken: await readSessionToken(sandbox),
  envVars: { ...process.env, ...session.envs },
  nodeVersion: await getNodeVersion(sandbox),
  gitConfig: await getGitConfig(sandbox),
};
```

### 5. Git Context (⭐⭐⭐⭐)

**Source**: E2B Sandbox (git commands) + GitHub API

**Données Collectées**:
- Repository URL
- Current branch
- Commit history
- Uncommitted changes
- Remote URL
- Git status
- Last commit message

**Exemple**:
```typescript
const gitContext = {
  repository: await getGitRepository(sandbox),
  branch: await getCurrentBranch(sandbox),
  commits: await getRecentCommits(sandbox, 10),
  status: await getGitStatus(sandbox),
  changes: await getUncommittedChanges(sandbox),
};
```

### 6. Conversation Context (⭐⭐⭐⭐⭐)

**Source**: Convex Database (messages table)

**Données Collectées**:
- Previous messages (user and assistant)
- Tool calls historiques
- Tool results historiques
- Edits historiques
- Todos historiques
- Errors historiques

**Exemple**:
```typescript
const messages = await getSessionMessages(id);

const conversationContext = {
  messages: messages.slice(-50), // Derniers 50 messages
  toolCalls: messages
    .filter(m => m.metadata?.type === 'tool_call')
    .slice(-10),
  toolResults: messages
    .filter(m => m.metadata?.type === 'tool_result')
    .slice(-10),
  edits: messages
    .filter(m => m.metadata?.type === 'edit')
    .slice(-10),
  errors: messages
    .filter(m => m.role === 'assistant' && m.content.includes('Error'))
    .slice(-5),
};
```

### 7. Cost Context (⭐⭐⭐)

**Source**: Convex Database (costs, billing)

**Données Collectées**:
- Total cost for session
- Credits remaining
- Tokens remaining
- Billing mode (credits/tokens)
- Last cost update

**Exemple**:
```typescript
const costContext = {
  totalCost: sessionData.totalCostUSD || 0,
  creditsRemaining: billingStatus?.creditsRemaining || 0,
  tokensRemaining: billingStatus?.tokensRemaining || 0,
  billingMode: billingStatus?.billingMode || 'tokens',
  lastCostUpdate: sessionData.lastCostUpdate,
};
```

---

## 🔨 CONTEXT BUILDING

### Processus de Construction

**Source**: `lib/prompts.ts` + `lib/inngest/functions/run-agent.ts`

```typescript
// Fonction conceptuelle de construction du contexte
const buildContext = async (sessionId: string, message: string): Promise<SessionContext> => {
  // 1. Récupérer les données de session
  const session = await getSessionData(sessionId);
  
  // 2. Récupérer les messages
  const messages = await getSessionMessages(sessionId);
  
  // 3. Récupérer les données utilisateur
  const user = await getUserData(session.createdBy);
  
  // 4. Connecter à la sandbox
  const sandbox = await connectToSandbox(session.sessionId);
  
  // 5. Construire le contexte projet
  const projectContext = await buildProjectContext(sandbox);
  
  // 6. Construire le contexte fichier
  const fileContext = await buildFileContext(sandbox, message);
  
  // 7. Construire le contexte session
  const sessionContext = buildSessionContext(session);
  
  // 8. Construire le contexte environnement
  const envContext = await buildEnvironmentContext(sandbox, session);
  
  // 9. Construire le contexte git
  const gitContext = await buildGitContext(sandbox);
  
  // 10. Construire le contexte conversation
  const conversationContext = buildConversationContext(messages);
  
  // 11. Construire le contexte coût
  const costContext = buildCostContext(session, user);
  
  // 12. Combiner tous les contextes
  return {
    project: projectContext,
    file: fileContext,
    session: sessionContext,
    environment: envContext,
    git: gitContext,
    conversation: conversationContext,
    cost: costContext,
    timestamp: Date.now(),
  };
};
```

### Optimisation du Contexte

Pour éviter de surcharger le prompt système:

1. **Limite le nombre de fichiers**: Max 20 fichiers pertinents
2. **Limite le nombre de messages**: Max 50 messages précédents
3. **Limite la taille du contenu**: Max 1000 caractères par fichier
4. **Cache les résultats**: Cache des données fréquemment utilisées
5. **Lazy loading**: Charge certaines données uniquement si nécessaire

---

## 📝 SYSTEM PROMPT GENERATION

### Structure du System Prompt

**Source**: `lib/prompts.ts`

```typescript
export const getSystemPrompt = (context: SessionContext): string => `
You are Vibra Code, an AI-powered mobile app builder.

## Your Role
You are an expert React Native developer. Your job is to help users build mobile apps by writing code, fixing bugs, and implementing features.

## Context
- Current directory: ${context.environment.cwd}
- Session ID: ${context.session.sessionId}
- Project: ${context.project.name || 'New Project'}
- Template: ${context.project.template?.name || 'Custom'}
- User: ${context.session.createdBy}

## Available Files
${context.file.relevantFiles?.map(f => 
  \`\`\`${f.path}\`\`\`\n\${f.content.substring(0, 200)}${f.content.length > 200 ? '...' : ''}\n\n\`
).join('') || 'No files yet'}

## Project Structure
\${context.project.structure || 'Empty project'}

## Current State
\${context.session.statusMessage || 'Starting fresh'}

## Recent Changes
\${context.conversation.edits?.slice(-5).map(e => 
  \`- Edited \${e.filePath}: \${e.description || 'No description'}\n\`
).join('') || 'No recent changes'}

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
✅ Create GitHub repositories
✅ Push to GitHub
✅ Create pull requests

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
11. Be thorough and careful
12. If you make a mistake, acknowledge it and fix it

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
- Node.js version: \${context.environment.nodeVersion || '18+'}
- npm/yarn/pnpm: Available
- Expo CLI: Available
- Git: Available
- Working directory: \${context.environment.cwd || '/vibe0'}
- Sandbox ID: \${context.environment.sandboxId}

## User Preferences
- Agent type: \${context.session.agentType || 'cursor'}
- Billing mode: \${context.cost.billingMode || 'tokens'}

## Important Notes
- The user is counting on you to build their app correctly
- Double-check your work
- Be thorough and careful
- If you encounter an error, try to understand it and fix it
- If you need to install dependencies, use the appropriate package manager
- If you need to run commands, use the bash tool
- If you need to read files, use the read tool
`;
```

### Personnalisation du Prompt

Le prompt peut être personnalisé en fonction:
- Du template utilisé
- Du type de projet
- Des préférences utilisateur
- Du contexte spécifique

**Exemple de personnalisation**:
```typescript
// Pour un projet React Native
const reactNativePrompt = getSystemPrompt({
  ...context,
  project: {
    ...context.project,
    type: 'react-native',
  },
});

// Pour un projet Next.js
const nextJsPrompt = getSystemPrompt({
  ...context,
  project: {
    ...context.project,
    type: 'nextjs',
  },
});
```

---

## 📁 CONTEXT TYPES

### Interface SessionContext

```typescript
interface SessionContext {
  // Project
  project: {
    name: string;
    type: 'react-native' | 'nextjs' | 'expo' | 'custom';
    template: Template;
    structure: string;
    dependencies: Record<string, string>;
    config: any;
  };
  
  // File
  file: {
    current?: {
      path: string;
      content: string;
      language: string;
    };
    relevantFiles: RelevantFile[];
    symbols: SymbolInfo[];
  };
  
  // Session
  session: {
    sessionId: string;
    sessionDbId: Id<"sessions">;
    name: string;
    status: SessionStatus;
    statusMessage: string;
    createdBy: string;
    templateId: string;
    tunnelUrl?: string;
    githubRepository?: string;
    envs: Record<string, string>;
    totalCost: number;
    messageCount: number;
    agentStopped: boolean;
  };
  
  // Environment
  environment: {
    sandboxId: string;
    cwd: string;
    sessionToken: string;
    envVars: Record<string, string>;
    nodeVersion: string;
    gitConfig: GitConfig;
  };
  
  // Git
  git: {
    repository?: string;
    branch?: string;
    commits: GitCommit[];
    status: string;
    changes: GitChange[];
  };
  
  // Conversation
  conversation: {
    messages: Message[];
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    edits: Edit[];
    todos: Todo[];
    errors: string[];
  };
  
  // Cost
  cost: {
    totalCost: number;
    creditsRemaining: number;
    tokensRemaining: number;
    billingMode: 'credits' | 'tokens';
  };
  
  // Timestamp
  timestamp: number;
}
```

### Interface RelevantFile

```typescript
interface RelevantFile {
  path: string;
  content: string;
  language: string;
  size: number;
  lastModified: number;
  description?: string;
}
```

### Interface SymbolInfo

```typescript
interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'interface' | 'type';
  location: {
    file: string;
    line: number;
    column: number;
  };
  definition: string;
  usageCount: number;
}
```

---

## 🔍 RELEVANT FILES DETECTION

### Algorithme de Détection

**Source**: Conceptuel (basé sur l'analyse du code Vibra)

```typescript
const detectRelevantFiles = async (
  sessionId: string,
  message: string,
  limit: number = 20
): Promise<RelevantFile[]> => {
  // 1. Fichiers récemment modifiés
  const recentFiles = await getRecentlyModifiedFiles(sessionId);
  
  // 2. Fichiers mentionnés dans le message
  const mentionedFiles = extractFilePathsFromMessage(message);
  
  // 3. Fichiers ouverts dans l'éditeur
  const openFiles = await getOpenFiles(sessionId);
  
  // 4. Fichiers pertinents pour le projet
  const projectFiles = await getProjectRelevantFiles(sessionId);
  
  // 5. Combinaison
  const allFiles = [...recentFiles, ...mentionedFiles, ...openFiles, ...projectFiles];
  
  // 6. Deduplication
  const seen = new Set<string>();
  const uniqueFiles: RelevantFile[] = [];
  
  for (const file of allFiles) {
    if (!seen.has(file.path)) {
      seen.add(file.path);
      uniqueFiles.push(file);
    }
  }
  
  // 7. Tri par pertinence
  const sortedFiles = uniqueFiles.sort((a, b) => {
    // Fichiers mentionnés dans le message en premier
    if (mentionedFiles.some(f => f.path === a.path)) return -1;
    if (mentionedFiles.some(f => f.path === b.path)) return 1;
    
    // Puis fichiers récemment modifiés
    if (recentFiles.some(f => f.path === a.path)) return -1;
    if (recentFiles.some(f => f.path === b.path)) return 1;
    
    // Puis fichiers ouverts
    if (openFiles.some(f => f.path === a.path)) return -1;
    if (openFiles.some(f => f.path === b.path)) return 1;
    
    // Puis par date de modification
    return b.lastModified - a.lastModified;
  });
  
  // 8. Limite
  return sortedFiles.slice(0, limit);
};
```

### Extraction des Paths depuis le Message

```typescript
const extractFilePathsFromMessage = (message: string): RelevantFile[] => {
  const filePatterns = [
    // Paths absolus
    /\/([a-zA-Z0-9_\-\.\/]+)/g,
    // Paths relatifs
    /(?:^|\s)([a-zA-Z0-9_\-\.\/]+\.(ts|tsx|js|jsx|json|yaml|yml|md|txt|css|scss|html))/g,
    // Paths avec extensions
    /([a-zA-Z0-9_\-\.\/]+\.(ts|tsx|js|jsx|json|yaml|yml|md|txt|css|scss|html))/g,
    // Paths dans des backticks
    /`([a-zA-Z0-9_\-\.\/]+)`/g,
    // Paths dans des quotes
    /["']([a-zA-Z0-9_\-\.\/]+)["']/g,
  ];
  
  const paths = new Set<string>();
  
  for (const pattern of filePatterns) {
    const matches = message.match(pattern) || [];
    for (const match of matches) {
      // Nettoyer le path
      let path = match
        .replace(/[`"']/g, '')
        .replace(/^\//, '')
        .replace(/^src\//, 'src/')
        .trim();
      
      // Vérifier que c'est un path valide
      if (isValidFilePath(path)) {
        paths.add(path);
      }
    }
  }
  
  // Récupérer les infos pour chaque path
  return Array.from(paths).map(path => ({
    path,
    content: '', // À charger
    language: getLanguageFromPath(path),
    size: 0,    // À charger
    lastModified: 0, // À charger
  }));
};
```

### Fichiers Pertinents pour le Projet

```typescript
const getProjectRelevantFiles = async (sessionId: string): Promise<RelevantFile[]> => {
  const session = await getSessionData(sessionId);
  const sandbox = await connectToSandbox(session.sessionId);
  
  // 1. Fichiers de configuration
  const configFiles = [
    'package.json',
    'tsconfig.json',
    'app.json',
    'app.config.js',
    'babel.config.js',
    '.eslintrc.js',
    '.prettierrc',
    'tailwind.config.js',
  ];
  
  // 2. Fichiers principaux
  const mainFiles = [
    'App.tsx',
    'App.js',
    'index.tsx',
    'index.js',
    'main.tsx',
    'main.js',
  ];
  
  // 3. Dossiers importants
  const importantDirs = [
    'src',
    'components',
    'screens',
    'navigation',
    'hooks',
    'utils',
    'lib',
    'types',
    'constants',
    'assets',
  ];
  
  // 4. Récupérer les infos des fichiers
  const files: RelevantFile[] = [];
  
  for (const file of [...configFiles, ...mainFiles]) {
    try {
      const content = await sandbox.files.read(file);
      files.push({
        path: file,
        content,
        language: getLanguageFromPath(file),
        size: content.length,
        lastModified: await getFileModificationTime(sandbox, file),
      });
    } catch {
      // Fichier non trouvé
    }
  }
  
  // 5. Lister les fichiers des dossiers importants
  for (const dir of importantDirs) {
    try {
      const dirFiles = await sandbox.files.list(dir);
      for (const file of dirFiles.slice(0, 5)) { // Max 5 par dossier
        try {
          const content = await sandbox.files.read(`${dir}/${file}`);
          files.push({
            path: `${dir}/${file}`,
            content,
            language: getLanguageFromPath(file),
            size: content.length,
            lastModified: await getFileModificationTime(sandbox, `${dir}/${file}`),
          });
        } catch {
          // Fichier non trouvé
        }
      }
    } catch {
      // Dossier non trouvé
    }
  }
  
  return files;
};
```

---

## 📊 PROJECT ANALYSIS

### Analyse de la Structure du Projet

```typescript
const analyzeProjectStructure = async (sandbox: Sandbox, cwd: string = '/vibe0'): Promise<ProjectStructure> => {
  // 1. Lister tous les fichiers/dossiers
  const allItems = await listAllFiles(sandbox, cwd);
  
  // 2. Catégoriser les fichiers
  const categorized = {
    config: allItems.filter(isConfigFile),
    source: allItems.filter(isSourceFile),
    test: allItems.filter(isTestFile),
    asset: allItems.filter(isAssetFile),
    documentation: allItems.filter(isDocumentationFile),
    other: allItems.filter(f => !isConfigFile(f) && !isSourceFile(f) && !isTestFile(f) && !isAssetFile(f) && !isDocumentationFile(f)),
  };
  
  // 3. Détecter le type de projet
  const projectType = detectProjectType(allItems);
  
  // 4. Détecter les frameworks
  const frameworks = detectFrameworks(allItems);
  
  // 5. Détecter les langages
  const languages = detectLanguages(allItems);
  
  // 6. Détecter les dépendances
  const dependencies = await extractDependencies(sandbox, cwd);
  
  // 7. Construire la structure
  return {
    cwd,
    type: projectType,
    frameworks,
    languages,
    dependencies,
    categorized,
    tree: buildFileTree(allItems),
  };
};
```

### Détection du Type de Projet

```typescript
const detectProjectType = (files: FileInfo[]): ProjectType => {
  const hasPackageJson = files.some(f => f.path === 'package.json');
  const hasAppJson = files.some(f => f.path === 'app.json' || f.path === 'app.config.js');
  const hasNextConfig = files.some(f => f.path === 'next.config.js' || f.path === 'next.config.ts');
  const hasWebpackConfig = files.some(f => f.path === 'webpack.config.js' || f.path === 'webpack.config.ts');
  const hasViteConfig = files.some(f => f.path === 'vite.config.js' || f.path === 'vite.config.ts');
  
  if (hasAppJson) {
    return 'expo';
  } else if (hasNextConfig) {
    return 'nextjs';
  } else if (hasPackageJson) {
    const packageJson = files.find(f => f.path === 'package.json');
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson.content);
        if (pkg.dependencies && (pkg.dependencies['react-native'] || pkg.dependencies['expo'])) {
          return 'react-native';
        } else if (pkg.dependencies && pkg.dependencies['next']) {
          return 'nextjs';
        } else if (pkg.dependencies && pkg.dependencies['vue']) {
          return 'vue';
        } else if (pkg.dependencies && pkg.dependencies['svelte']) {
          return 'svelte';
        }
      } catch {
        // Ignorer
      }
    }
    return 'node';
  }
  
  return 'unknown';
};
```

### Extraction des Dépendances

```typescript
const extractDependencies = async (sandbox: Sandbox, cwd: string): Promise<Dependencies> => {
  try {
    // 1. Lire package.json
    const packageJsonContent = await sandbox.files.read(`${cwd}/package.json`);
    const packageJson = JSON.parse(packageJsonContent);
    
    // 2. Extraire les dépendances
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    const peerDependencies = packageJson.peerDependencies || {};
    
    // 3. Lire les lock files pour les versions exactes
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    let exactVersions: Record<string, string> = {};
    
    for (const lockFile of lockFiles) {
      try {
        const lockContent = await sandbox.files.read(`${cwd}/${lockFile}`);
        exactVersions = { ...exactVersions, ...parseLockFile(lockFile, lockContent) };
      } catch {
        // Lock file non trouvé
      }
    }
    
    // 4. Détecter les dépendances importantes
    const importantDeps = {
      react: dependencies['react'] || devDependencies['react'],
      'react-native': dependencies['react-native'] || devDependencies['react-native'],
      expo: dependencies['expo'] || devDependencies['expo'],
      next: dependencies['next'] || devDependencies['next'],
      typescript: dependencies['typescript'] || devDependencies['typescript'],
      // ...
    };
    
    return {
      dependencies,
      devDependencies,
      peerDependencies,
      exactVersions,
      importantDeps,
      total: Object.keys(dependencies).length + Object.keys(devDependencies).length,
    };
  } catch {
    return {
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      exactVersions: {},
      importantDeps: {},
      total: 0,
    };
  }
};
```

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| Project Context | ✅ | ⭐ | ⭐⭐ |
| File Context | ✅ | ⭐ | ⭐⭐ |
| Session Context | ✅ | ✅ | ⭐⭐⭐⭐ |
| Environment Context | ✅ | ✅ | ⭐⭐⭐ |
| Git Context | ✅ | ✅ | ⭐⭐⭐ |
| Conversation Context | ✅ | ⭐ | ⭐ |
| Cost Context | ✅ | ⭐ | ⭐ |
| System Prompt | ✅ | ⭐ | ⭐ |
| Relevant Files | ✅ | ⭐ | ⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| Context Sources | Multiples (Convex, E2B, GitHub) | À définir | **Adapter** |
| Context Building | Dynamique, complet | À implémenter | **Implémenter** |
| System Prompt | Très détaillé, personnalisé | À améliorer | **Améliorer** |
| Relevant Files | Algorithme avancé | À implémenter | **Implémenter** |
| Project Analysis | Complet | À implémenter | **Implémenter** |

### Avantages Vibra à Extraire

1. **Multi-Source Context**: Combinaison de Convex, E2B, GitHub, Template
2. **Dynamic Context Building**: Construction à la volée en fonction du besoin
3. **Comprehensive System Prompt**: Prompt très détaillé et personnalisable
4. **Relevant Files Detection**: Algorithme intelligent de détection
5. **Project Analysis**: Analyse complète de la structure du projet
6. **Context Optimization**: Limite la taille, cache, lazy loading

### Points à Améliorer dans SoryOS

1. **ContextBuilder**: Doit être aussi complet que Vibra
2. **Context Sources**: Doit supporter Convex, E2B, GitHub, etc.
3. **System Prompt**: Doit être dynamique et personnalisable
4. **Relevant Files**: Doit implémenter un algorithme de détection
5. **Project Analysis**: Doit analyser la structure du projet

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. ContextBuilder (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/context/src/builder.rs

use std::sync::Arc;
use async_trait::async_trait;
use serde_json::Value;

#[derive(Debug, Clone)]
pub struct Context {
    pub project: ProjectContext,
    pub file: FileContext,
    pub session: SessionContext,
    pub environment: EnvironmentContext,
    pub git: GitContext,
    pub conversation: ConversationContext,
    pub cost: CostContext,
    pub timestamp: i64,
}

#[derive(Debug, Clone)]
pub struct ProjectContext {
    pub name: String,
    pub r#type: ProjectType,
    pub template: Option<Template>,
    pub structure: String,
    pub dependencies: HashMap<String, String>,
    pub config: Value,
}

#[derive(Debug, Clone)]
pub struct FileContext {
    pub current: Option<CurrentFile>,
    pub relevant_files: Vec<RelevantFile>,
    pub symbols: Vec<SymbolInfo>,
}

#[derive(Debug, Clone)]
pub struct SessionContext {
    pub session_id: String,
    pub db_id: String,
    pub name: String,
    pub status: SessionStatus,
    pub status_message: String,
    pub created_by: String,
    pub template_id: String,
    pub tunnel_url: Option<String>,
    pub github_repository: Option<String>,
    pub envs: HashMap<String, String>,
    pub total_cost: f64,
    pub message_count: i32,
    pub agent_stopped: bool,
}

#[derive(Debug, Clone)]
pub struct EnvironmentContext {
    pub sandbox_id: String,
    pub cwd: String,
    pub session_token: String,
    pub env_vars: HashMap<String, String>,
    pub node_version: String,
    pub git_config: GitConfig,
}

#[derive(Debug, Clone)]
pub struct GitContext {
    pub repository: Option<String>,
    pub branch: Option<String>,
    pub commits: Vec<GitCommit>,
    pub status: String,
    pub changes: Vec<GitChange>,
}

#[derive(Debug, Clone)]
pub struct ConversationContext {
    pub messages: Vec<Message>,
    pub tool_calls: Vec<ToolCall>,
    pub tool_results: Vec<ToolResult>,
    pub edits: Vec<Edit>,
    pub todos: Vec<Todo>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CostContext {
    pub total_cost: f64,
    pub credits_remaining: f64,
    pub tokens_remaining: i32,
    pub billing_mode: BillingMode,
}

#[derive(Debug, Clone, strum::Display)]
pub enum ProjectType {
    ReactNative,
    NextJs,
    Expo,
    Node,
    Vue,
    Svelte,
    Custom,
    Unknown,
}

#[derive(Debug, Clone, strum::Display)]
pub enum BillingMode {
    Credits,
    Tokens,
}

#[derive(Debug, Clone)]
pub struct ContextBuilder {
    workspace: Arc<Workspace>,
    session_manager: Arc<SessionManager>,
    execution_provider: Arc<dyn ExecutionProvider>,
    github_manager: Arc<GitHubManager>,
}

impl ContextBuilder {
    pub fn new(
        workspace: Arc<Workspace>,
        session_manager: Arc<SessionManager>,
        execution_provider: Arc<dyn ExecutionProvider>,
        github_manager: Arc<GitHubManager>,
    ) -> Self {
        Self {
            workspace,
            session_manager,
            execution_provider,
            github_manager,
        }
    }
    
    pub async fn build(&self, session_id: &str, message: &str) -> Result<Context, ContextError> {
        // 1. Build project context
        let project = self.build_project_context(session_id).await?;
        
        // 2. Build file context
        let file = self.build_file_context(session_id, message).await?;
        
        // 3. Build session context
        let session = self.build_session_context(session_id).await?;
        
        // 4. Build environment context
        let environment = self.build_environment_context(session_id).await?;
        
        // 5. Build git context
        let git = self.build_git_context(session_id).await?;
        
        // 6. Build conversation context
        let conversation = self.build_conversation_context(session_id).await?;
        
        // 7. Build cost context
        let cost = self.build_cost_context(session_id).await?;
        
        Ok(Context {
            project,
            file,
            session,
            environment,
            git,
            conversation,
            cost,
            timestamp: chrono::Utc::now().timestamp(),
        })
    }
    
    pub async fn build_project_context(&self, session_id: &str) -> Result<ProjectContext, ContextError> {
        let session = self.session_manager.get(session_id).await?;
        let workspace = self.workspace.get(session.workspace_id).await?;
        
        // Détecter le type de projet
        let project_type = self.detect_project_type(&workspace.path).await?;
        
        // Extraire les dépendances
        let dependencies = self.extract_dependencies(&workspace.path).await?;
        
        // Lire la configuration
        let config = self.read_config(&workspace.path).await?;
        
        // Construire la structure
        let structure = self.build_structure(&workspace.path).await?;
        
        Ok(ProjectContext {
            name: session.name.clone(),
            r#type: project_type,
            template: session.template.clone(),
            structure,
            dependencies,
            config,
        })
    }
    
    pub async fn build_file_context(&self, session_id: &str, message: &str) -> Result<FileContext, ContextError> {
        let session = self.session_manager.get(session_id).await?;
        
        // Détecter les fichiers pertinents
        let relevant_files = self.detect_relevant_files(session_id, message).await?;
        
        // Extraire les symboles
        let symbols = self.extract_symbols(&relevant_files).await?;
        
        Ok(FileContext {
            current: None, // À implémenter
            relevant_files,
            symbols,
        })
    }
    
    // ... autres méthodes build_*
    
    pub async fn detect_project_type(&self, path: &str) -> Result<ProjectType, ContextError> {
        let files = self.execution_provider.list_files(path).await?;
        
        if files.iter().any(|f| f.name == "app.json" || f.name == "app.config.js") {
            return Ok(ProjectType::Expo);
        } else if files.iter().any(|f| f.name == "next.config.js" || f.name == "next.config.ts") {
            return Ok(ProjectType::NextJs);
        } else if files.iter().any(|f| f.name == "package.json") {
            let package_json = self.execution_provider.read_file(&format!("{}/package.json", path)).await?;
            let pkg: serde_json::Value = serde_json::from_str(&package_json)?;
            
            if let Some(deps) = pkg.get("dependencies").and_then(|d| d.as_object()) {
                if deps.contains_key("react-native") || deps.contains_key("expo") {
                    return Ok(ProjectType::ReactNative);
                } else if deps.contains_key("next") {
                    return Ok(ProjectType::NextJs);
                } else if deps.contains_key("vue") {
                    return Ok(ProjectType::Vue);
                } else if deps.contains_key("svelte") {
                    return Ok(ProjectType::Svelte);
                }
            }
            
            return Ok(ProjectType::Node);
        }
        
        Ok(ProjectType::Unknown)
    }
    
    pub async fn detect_relevant_files(&self, session_id: &str, message: &str) -> Result<Vec<RelevantFile>, ContextError> {
        let session = self.session_manager.get(session_id).await?;
        
        // 1. Fichiers récemment modifiés
        let recent_files = self.get_recently_modified_files(session_id).await?;
        
        // 2. Fichiers mentionnés dans le message
        let mentioned_files = self.extract_file_paths_from_message(message);
        
        // 3. Fichiers ouverts
        let open_files = self.get_open_files(session_id).await?;
        
        // 4. Combinaison et déduplication
        let mut all_files = vec![recent_files, mentioned_files, open_files].concat();
        all_files.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
        all_files.dedup_by(|a, b| a.path == b.path);
        
        // 5. Limite
        Ok(all_files.into_iter().take(20).collect())
    }
    
    pub fn extract_file_paths_from_message(&self, message: &str) -> Vec<RelevantFile> {
        let file_patterns = [
            r"\/([a-zA-Z0-9_\-\.\/]+)",
            r"(?:^|\s)([a-zA-Z0-9_\-\.\/]+\.(ts|tsx|js|jsx|json|yaml|yml|md|txt|css|scss|html))",
        ];
        
        let mut paths = std::collections::HashSet::new();
        
        for pattern in file_patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                for cap in re.captures_iter(message) {
                    if let Some(path) = cap.get(1) {
                        paths.insert(path.as_str().to_string());
                    }
                }
            }
        }
        
        paths.into_iter().map(|path| RelevantFile {
            path,
            content: String::new(), // À charger
            language: self.detect_language(&path),
            size: 0, // À charger
            last_modified: 0, // À charger
        }).collect()
    }
    
    // ... autres méthodes
}

#[async_trait]
pub trait ContextSource: Send + Sync {
    async fn get_project_context(&self) -> Result<ProjectContext, ContextError>;
    async fn get_file_context(&self) -> Result<FileContext, ContextError>;
    async fn get_session_context(&self, session_id: &str) -> Result<SessionContext, ContextError>;
    async fn get_environment_context(&self) -> Result<EnvironmentContext, ContextError>;
    async fn get_git_context(&self) -> Result<GitContext, ContextError>;
    async fn get_conversation_context(&self, session_id: &str) -> Result<ConversationContext, ContextError>;
    async fn get_cost_context(&self, session_id: &str) -> Result<CostContext, ContextError>;
}
```

#### 2. System Prompt Generator (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/context/src/prompts.rs

use std::collections::HashMap;

pub struct SystemPromptGenerator;

impl SystemPromptGenerator {
    pub fn generate(context: &Context) -> String {
        let mut prompt = String::new();
        
        // Header
        prompt.push_str("You are SoryOS Code, an AI-powered development assistant.\n\n");
        
        // Role
        prompt.push_str("## Your Role\n");
        prompt.push_str("You are an expert developer. Your job is to help users build applications by writing code, fixing bugs, and implementing features.\n\n");
        
        // Context
        prompt.push_str("## Context\n");
        prompt.push_str(&format!("- Current directory: {}\n", context.environment.cwd));
        prompt.push_str(&format!("- Session ID: {}\n", context.session.session_id));
        prompt.push_str(&format!("- Project: {}\n", context.project.name));
        prompt.push_str(&format!("- Template: {}\n", context.project.r#type));
        prompt.push_str(&format!("- User: {}\n\n", context.session.created_by));
        
        // Available Files
        if !context.file.relevant_files.is_empty() {
            prompt.push_str("## Available Files\n");
            for file in &context.file.relevant_files {
                prompt.push_str(&format!("\n### {} ({})\n", file.path, file.language));
                prompt.push_str(&format!("```{}\n", file.language));
                prompt.push_str(&file.content.chars().take(200).collect::<String>());
                if file.content.len() > 200 {
                    prompt.push_str("...");
                }
                prompt.push_str("\n```\n");
            }
            prompt.push_str("\n");
        }
        
        // Project Structure
        if !context.project.structure.is_empty() {
            prompt.push_str("## Project Structure\n");
            prompt.push_str(&format!("```\n{}\n```\n\n", context.project.structure));
        }
        
        // Current State
        if !context.session.status_message.is_empty() {
            prompt.push_str("## Current State\n");
            prompt.push_str(&format!("{}\n\n", context.session.status_message));
        }
        
        // Recent Changes
        if !context.conversation.edits.is_empty() {
            prompt.push_str("## Recent Changes\n");
            for edit in context.conversation.edits.iter().take(5) {
                prompt.push_str(&format!("- Edited {}: {}\n", edit.file_path, edit.description));
            }
            prompt.push_str("\n");
        }
        
        // Capabilities
        prompt.push_str("## Capabilities\n");
        prompt.push_str("✅ Read and write files\n");
        prompt.push_str("✅ Execute terminal commands\n");
        prompt.push_str("✅ Run npm/yarn/pnpm commands\n");
        prompt.push_str("✅ Perform git operations (add, commit, push)\n");
        prompt.push_str("✅ Install dependencies\n");
        prompt.push_str("✅ Start and stop development servers\n");
        prompt.push_str("✅ Create and modify components\n");
        prompt.push_str("✅ Handle TypeScript types\n");
        prompt.push_str("✅ Access environment variables\n");
        prompt.push_str("✅ Create GitHub repositories\n");
        prompt.push_str("✅ Push to GitHub\n");
        prompt.push_str("✅ Create pull requests\n\n");
        
        // Rules
        prompt.push_str("## Rules\n");
        prompt.push_str("1. ALWAYS verify your changes work before presenting them\n");
        prompt.push_str("2. Use TypeScript for all new files\n");
        prompt.push_str("3. Follow best practices\n");
        prompt.push_str("4. Use meaningful names\n");
        prompt.push_str("5. Add error handling\n");
        prompt.push_str("6. Include necessary imports\n");
        prompt.push_str("7. Add comments for complex logic\n");
        prompt.push_str("8. Test your code when possible\n");
        prompt.push_str("9. Ask for clarification if the request is ambiguous\n");
        prompt.push_str("10. Be thorough and careful\n\n");
        
        // Output Format
        prompt.push_str("## Output Format\n");
        prompt.push_str("ALWAYS use the JSON stream format for tool interactions:\n\n");
        prompt.push_str("For messages:\n");
        prompt.push_str("```json\n");
        prompt.push_str("{\n");
        prompt.push_str("  \"type\": \"message\",\n");
        prompt.push_str("  \"role\": \"assistant\",\n");
        prompt.push_str("  \"content\": \"Your message here\",\n");
        prompt.push_str("  \"delta\": true\n");
        prompt.push_str("}\n");
        prompt.push_str("```\n\n");
        
        prompt.push_str("For file edits:\n");
        prompt.push_str("```json\n");
        prompt.push_str("{\n");
        prompt.push_str("  \"type\": \"edit\",\n");
        prompt.push_str("  \"filePath\": \"path/to/file.ts\",\n");
        prompt.push_str("  \"oldString\": \"old code\",\n");
        prompt.push_str("  \"newString\": \"new code\"\n");
        prompt.push_str("}\n");
        prompt.push_str("```\n\n");
        
        prompt.push_str("For todos:\n");
        prompt.push_str("```json\n");
        prompt.push_str("{\n");
        prompt.push_str("  \"type\": \"todo\",\n");
        prompt.push_str("  \"id\": \"unique-id\",\n");
        prompt.push_str("  \"status\": \"in_progress\",\n");
        prompt.push_str("  \"description\": \"Task description\"\n");
        prompt.push_str("}\n");
        prompt.push_str("```\n\n");
        
        prompt.push_str("For tool calls:\n");
        prompt.push_str("```json\n");
        prompt.push_str("{\n");
        prompt.push_str("  \"type\": \"tool_call\",\n");
        prompt.push_str("  \"name\": \"bash\",\n");
        prompt.push_str("  \"arguments\": {\n");
        prompt.push_str("    \"command\": \"ls -la\"\n");
        prompt.push_str("  }\n");
        prompt.push_str("}\n");
        prompt.push_str("```\n\n");
        
        // Environment
        prompt.push_str("## Environment\n");
        prompt.push_str(&format!("- Node.js version: {}\n", context.environment.node_version));
        prompt.push_str("- npm/yarn/pnpm: Available\n");
        prompt.push_str("- Git: Available\n");
        prompt.push_str(&format!("- Working directory: {}\n", context.environment.cwd));
        prompt.push_str(&format!("- Sandbox ID: {}\n\n", context.environment.sandbox_id));
        
        // Important Notes
        prompt.push_str("## Important Notes\n");
        prompt.push_str("- The user is counting on you to build their app correctly\n");
        prompt.push_str("- Double-check your work\n");
        prompt.push_str("- Be thorough and careful\n");
        prompt.push_str("- If you encounter an error, try to understand it and fix it\n");
        
        prompt
    }
    
    pub fn generate_for_provider(context: &Context, provider: &AIProvider) -> String {
        let mut prompt = Self::generate(context);
        
        // Ajouter des instructions spécifiques au provider
        match provider.name().as_str() {
            "claude" => {
                prompt.push_str("\n## Claude Specific Instructions\n");
                prompt.push_str("- Use the --continue flag for follow-up messages\n");
                prompt.push_str("- Be concise in your responses\n");
            }
            "cursor" => {
                prompt.push_str("\n## Cursor Specific Instructions\n");
                prompt.push_str("- Use the --resume flag for follow-up messages\n");
                prompt.push_str("- Focus on code generation\n");
            }
            "gemini" => {
                prompt.push_str("\n## Gemini Specific Instructions\n");
                prompt.push_str("- Use the --yolo flag for execution\n");
            }
            _ => {}
        }
        
        prompt
    }
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: Context System Foundation (Priorité ⭐⭐⭐⭐⭐)

1. **Définir les structures de données**
   - Créer `packages/context/src/types.rs`
   - Définir Context, ProjectContext, FileContext, etc.
   - Tester la sérialisation/désérialisation

2. **Créer le ContextBuilder**
   - Créer `packages/context/src/builder.rs`
   - Implémenter build() et toutes les méthodes build_*
   - Tester avec des projets réels

3. **Intégrer les ContextSources**
   - Créer les implémentations pour chaque source
   - Tester l'intégration

### Phase 2: Context Optimization (Priorité ⭐⭐⭐⭐)

4. **Implémenter Relevant Files Detection**
   - Créer `packages/context/src/relevant_files.rs`
   - Implémenter l'algorithme de détection
   - Tester avec différents messages

5. **Implémenter Project Analysis**
   - Créer `packages/context/src/project_analysis.rs`
   - Implémenter la détection du type de projet
   - Implémenter l'extraction des dépendances
   - Tester avec différents projets

### Phase 3: System Prompt (Priorité ⭐⭐⭐⭐)

6. **Créer le SystemPromptGenerator**
   - Créer `packages/context/src/prompts.rs`
   - Implémenter generate()
   - Tester avec différents contextes

7. **Personnaliser par Provider**
   - Ajouter generate_for_provider()
   - Tester avec chaque provider

---

## 📚 RÉFÉRENCES

- [Vibra Code Prompts](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/prompts.ts)
- [Vibra Code Run Agent](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/run-agent.ts)
- [Vibra Code Session Schema](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/convex/schema.ts)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
