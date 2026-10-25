# Vibra Code - Tool System Analysis

> **Projet**: Extraction du système de Tools de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [Tool Architecture](#-tool-architecture)
3. [Tool Definitions](#-tool-definitions)
4. [Tool Categories](#-tool-categories)
5. [Tool Execution](#-tool-execution)
6. [Streaming Output](#-streaming-output)
7. [Error Handling](#-error-handling)
8. [Tool Result Processing](#-tool-result-processing)
9. [Comparison avec SoryOS](#-comparison-avec-soryos)
10. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture du Tool System

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VIBRA CODE TOOL SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   AGENT     │    │   TOOL      │    │  EXECUTION  │              │
│  │  (Claude/   │    │  REGISTRY   │    │   PROVIDER  │              │
│  │   Cursor/   │───►│  (Implicit)  │───►│    (E2B)     │              │
│  │   Gemini)   │    │             │    │             │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     TOOL CALL FLOW                               │   │
│  │                                                                      │   │
│  │  1. Agent generates tool call in JSON stream format             │   │
│  │  2. Tool call parsed from stdout                               │   │
│  │  3. Tool execution in E2B sandbox                              │   │
│  │  4. Result streaming back to agent                             │   │
│  │  5. Result processing and state update                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `lib/inngest/functions/run-agent.ts` | Parsing des tool calls | ⭐⭐⭐⭐⭐ | 1200+ |
| `lib/e2b/config.ts` | Exécution des outils | ⭐⭐⭐⭐⭐ | 700+ |
| `lib/prompts.ts` | Définition des outils dans le prompt | ⭐⭐⭐⭐ | 600+ |

---

## 🏗️ TOOL ARCHITECTURE

### Concepts de Base

Dans Vibra Code, les **tools** ne sont pas explicitement définis comme des objets ou classes. 
Au lieu de cela, ils sont:

1. **Définis dans le System Prompt** - L'agent sait quels outils sont disponibles
2. **Appelés via JSON Stream** - L'agent génère des tool calls au format JSON
3. **Exécutés dans la Sandbox** - Les commandes sont exécutées dans E2B
4. **Parsés depuis stdout** - Les résultats sont extraits du streaming output

### Flow des Tools

```
AGENT
  │
  ▼
┌─────────────────────┐
│  Tool Call           │  (JSON: {type: "tool_call", name: "bash", arguments: {...}})
│  Generation          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  JSON Stream         │  (stdout de l'agent)
│  Parsing            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Tool Execution      │  (Exécution dans E2B sandbox)
│  in Sandbox          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Result Streaming    │  (stdout/stderr de la commande)
│  Back to Agent       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Result Parsing      │  (Extraction depuis le stream)
│  & Processing        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  State Update        │  (Mise à jour Convex DB)
│  & Persistence       │
└─────────────────────┘
```

---

## 📋 TOOL DEFINITIONS

### Format des Tool Calls

Les tool calls sont générés par l'agent au format **JSON stream**:

```json
{
  "type": "tool_call",
  "name": "bash",
  "arguments": {
    "command": "ls -la"
  }
}
```

### Format des Tool Results

Les résultats des outils sont retournés au format:

```json
{
  "type": "tool_result",
  "name": "bash",
  "arguments": {
    "command": "ls -la"
  },
  "result": {
    "stdout": "file1.txt\nfile2.txt\n",
    "stderr": "",
    "exitCode": 0
  }
}
```

---

## 📁 TOOL CATEGORIES

### 1. Filesystem Tools (⭐⭐⭐⭐⭐)

Les outils les plus utilisés dans Vibra Code.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `read` | Read File | Lit le contenu d'un fichier | `cat <file>` | `{ filePath: string }` |
| `write` | Write File | Crée/écrit un fichier | `echo > <file>` | `{ filePath: string, content: string }` |
| `edit` | Edit File | Modifie un fichier existant | `sed/sdk edit` | `{ filePath: string, oldString: string, newString: string }` |
| `search` | Search Files | Recherche dans les fichiers | `grep/rg` | `{ pattern: string, path?: string }` |
| `list` | List Files | Liste les fichiers d'un dossier | `ls -la` | `{ path?: string }` |
| `delete` | Delete File | Supprime un fichier | `rm <file>` | `{ filePath: string }` |
| `create` | Create File | Crée un nouveau fichier | `touch + echo` | `{ filePath: string, content?: string }` |

**Exemple d'utilisation**:
```json
{
  "type": "tool_call",
  "name": "read",
  "arguments": {
    "filePath": "src/components/Button.tsx"
  }
}
```

### 2. Terminal/Shell Tools (⭐⭐⭐⭐⭐)

Exécution de commandes shell.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `bash` | Execute Command | Exécute une commande shell | `bash -c "..."` | `{ command: string }` |
| `shell` | Shell Session | Session shell interactive | `sh` | `{ command?: string }` |
| `process` | Process Manager | Gère les processus | `ps aux \| grep` | `{ command: string, pid?: number }` |
| `kill` | Kill Process | Tue un processus | `kill <pid>` | `{ pid: number, signal?: string }` |

**Exemple d'utilisation**:
```json
{
  "type": "tool_call",
  "name": "bash",
  "arguments": {
    "command": "npm install react-native"
  }
}
```

### 3. Git Tools (⭐⭐⭐⭐⭐)

Opérations Git dans la sandbox.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `git_status` | Git Status | État du repo git | `git status` | `{ path?: string }` |
| `git_add` | Git Add | Ajoute des fichiers | `git add <files>` | `{ files: string[] }` |
| `git_commit` | Git Commit | Commit les changements | `git commit -m` | `{ message: string, files?: string[] }` |
| `git_push` | Git Push | Push vers remote | `git push` | `{ remote?: string, branch?: string }` |
| `git_clone` | Git Clone | Clone un repo | `git clone` | `{ url: string, path?: string }` |
| `git_branch` | Git Branch | Gestion des branches | `git branch` | `{ name: string, action: "create"\|"delete"\|"checkout"\|"list" }` |
| `git_pull` | Git Pull | Pull depuis remote | `git pull` | `{ remote?: string, branch?: string }` |
| `git_log` | Git Log | Historique des commits | `git log` | `{ limit?: number, path?: string }` |
| `git_diff` | Git Diff | Diff entre commits | `git diff` | `{ from?: string, to?: string, path?: string }` |

**Exemple d'utilisation**:
```json
{
  "type": "tool_call",
  "name": "git_commit",
  "arguments": {
    "message": "feat: add new Button component",
    "files": ["src/components/Button.tsx"]
  }
}
```

### 4. GitHub Tools (⭐⭐⭐⭐)

Intégration avec GitHub.

| Tool ID | Name | Description | Execution | Arguments |
|---------|------|-------------|-----------|-----------|
| `github_push` | Push to GitHub | Push le code vers GitHub | `E2BManager.commitAndPush()` | `{ token: string, repository: string, message: string }` |
| `github_pr` | Create PR | Crée une Pull Request | `createGitHubPullRequest()` | `{ token: string, repository: string, title: string, description?: string }` |
| `github_fork` | Fork Repository | Fork un repository | Octokit | `{ token: string, repository: string }` |
| `github_issue` | Create Issue | Crée un issue | Octokit | `{ token: string, repository: string, title: string, body: string }` |

**Exemple d'utilisation**:
```json
{
  "type": "tool_call",
  "name": "github_push",
  "arguments": {
    "repository": "user/repo",
    "message": "Initial commit"
  }
}
```

### 5. Project Tools (⭐⭐⭐⭐)

Gestion du projet.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `install` | Install Deps | Installe les dépendances | `npm install` / `yarn` / `pnpm install` | `{ manager?: "npm"\|"yarn"\|"pnpm" }` |
| `build` | Build Project | Build le projet | `npm run build` | `{ script?: string }` |
| `test` | Run Tests | Exécute les tests | `npm test` | `{ script?: string, args?: string[] }` |
| `start` | Start Server | Démarre le dev server | `npx expo start` | `{ port?: number, tunnel?: boolean }` |
| `stop` | Stop Server | Arrête le dev server | `pkill -f expo` | `{ force?: boolean }` |
| `run` | Run Script | Exécute un script npm | `npm run <script>` | `{ script: string, args?: string[] }` |

**Exemple d'utilisation**:
```json
{
  "type": "tool_call",
  "name": "install",
  "arguments": {
    "manager": "npm"
  }
}
```

### 6. Preview Tools (⭐⭐⭐⭐)

Preview de l'application.

| Tool ID | Name | Description | Execution | Arguments |
|---------|------|-------------|-----------|-----------|
| `preview` | Preview App | Obtient l'URL de preview | `getSandboxHost(port)` | `{ port: number }` |
| `tunnel` | Create Tunnel | Crée un tunnel | `expo start --tunnel` | `{ port: number }` |
| `health_check` | Health Check | Vérifie que le serveur répond | HTTP request | `{ url: string, timeout?: number }` |

**Exemple d'utilisation**:
```json
{
  "type": "tool_call",
  "name": "preview",
  "arguments": {
    "port": 3000
  }
}
```

### 7. Environment Tools (⭐⭐⭐)

Gestion des variables d'environnement.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `set_env` | Set Environment | Configure une variable | `export VAR=value` | `{ name: string, value: string, persistent?: boolean }` |
| `get_env` | Get Environment | Lit une variable | `printenv VAR` | `{ name?: string }` |
| `unset_env` | Unset Environment | Supprime une variable | `unset VAR` | `{ name: string }` |
| `list_env` | List Environment | Liste toutes les variables | `printenv` | `{ filter?: string }` |

**Exemple d'utilisation**:
```json
{
  "type": "tool_call",
  "name": "set_env",
  "arguments": {
    "name": "API_KEY",
    "value": "secret-key-123",
    "persistent": true
  }
}
```

### 8. System Tools (⭐⭐⭐)

Outils système.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `pwd` | Print Working Directory | Affiche le dossier courant | `pwd` | `{}` |
| `whoami` | Who Am I | Affiche l'utilisateur courant | `whoami` | `{}` |
| `date` | Date | Affiche la date/heure | `date` | `{ format?: string }` |
| `uname` | System Info | Affiche les infos système | `uname -a` | `{}` |
| `df` | Disk Space | Affiche l'espace disque | `df -h` | `{ path?: string }` |
| `free` | Memory | Affiche la mémoire | `free -h` | `{}` |

### 9. Network Tools (⭐⭐⭐)

Outils réseau.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `curl` | HTTP Request | Exécute une requête HTTP | `curl` | `{ url: string, method?: string, headers?: Record<string,string>, body?: string }` |
| `wget` | Download | Télécharge un fichier | `wget` | `{ url: string, output?: string }` |
| `ping` | Ping | Ping une adresse | `ping` | `{ host: string, count?: number }` |
| `netstat` | Network Stats | Affiche les stats réseau | `netstat` | `{}` |

### 10. File Transfer Tools (⭐⭐)

Transfert de fichiers.

| Tool ID | Name | Description | Command | Arguments |
|---------|------|-------------|---------|-----------|
| `download` | Download File | Télécharge un fichier | `curl/wget` | `{ url: string, path: string }` |
| `upload` | Upload File | Upload un fichier | `scp/curl` | `{ path: string, url: string }` |
| `copy` | Copy File | Copie un fichier | `cp` | `{ source: string, destination: string }` |
| `move` | Move File | Déplace un fichier | `mv` | `{ source: string, destination: string }` |

---

## ⚙️ TOOL EXECUTION

### Mécanisme d'Exécution

**Source**: `lib/inngest/functions/run-agent.ts` (processStdoutLine)

```typescript
// Dans le handler stdout
const processStdoutLine = async (parsedData: any, eventTimestamp: number) => {
  try {
    // ... autres types
    
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
      
      // Git tools
      else if (name === "git_commit" && arguments?.message) {
        const files = arguments.files || [];
        const message = arguments.message;
        
        // Construction de la commande git
        let command = `git add ${files.map(f => `"${f}"`).join(" ")}`;
        command += ` && git commit -m "${message.replace(/"/g, '\\"')}"`;
        
        const result = await e2bManager.executeCommand(command, {
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
      
      // GitHub tools
      else if (name === "github_push" && arguments?.repository) {
        const result = await e2bManager.commitAndPush(
          process.env.GITHUB_TOKEN || "",
          arguments.repository,
          arguments.message || "Commit from Vibra Code",
          true
        );
        
        await addMessage(id, JSON.stringify({
          type: "tool_result",
          name,
          arguments,
          result: {
            success: result.success,
            error: result.error,
          },
        }), "assistant", eventTimestamp);
      }
      
      // Autres outils...
      else {
        console.log("Unknown tool:", name, arguments);
        
        // Message d'erreur
        await addMessage(id, `⚠️ **Unknown Tool**\n\nTool "${name}" is not supported.`, "assistant", eventTimestamp);
      }
    }
    
  } catch (error) {
    console.error("Error processing tool call:", error);
  }
};
```

### Exécution dans E2B

**Source**: `lib/e2b/config.ts` (executeCommand)

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

### Mapping des Outils

| Tool Name | Command | Options |
|-----------|---------|---------|
| `bash` | `bash -c "{command}"` | `cwd`, `envVars` |
| `read` | `cat {filePath}` | `cwd` |
| `write` | `echo "{content}" > {filePath}` | `cwd` |
| `edit` | `sed -i 's/{oldString}/{newString}/g' {filePath}` | `cwd` |
| `search` | `grep -r "{pattern}" {path}` | `cwd`, `path` |
| `list` | `ls -la {path}` | `cwd`, `path` |
| `delete` | `rm -f {filePath}` | `cwd` |
| `git_status` | `git status` | `cwd` |
| `git_add` | `git add {files}` | `cwd` |
| `git_commit` | `git commit -m "{message}"` | `cwd` |
| `git_push` | `git push {remote} {branch}` | `cwd` |
| `install` | `npm install` | `cwd` |
| `build` | `npm run build` | `cwd` |
| `test` | `npm test` | `cwd` |

---

## 📡 STREAMING OUTPUT

### Format de Streaming

Les outils retournent leurs résultats via **stdout** et **stderr** en streaming.

**Exemple**:
```typescript
// Exécution d'une commande avec streaming
const result = await e2bManager.executeCommand("ls -la", {
  onStdout: (data) => {
    console.log("STDOUT:", data);
    // data = "file1.txt\nfile2.txt\n"
  },
  onStderr: (data) => {
    console.error("STDERR:", data);
    // data = "error: no such file\n"
  },
});
```

### Traitement du Streaming

Les résultats des outils sont:

1. **Streamés en temps réel** vers le handler stdout/stderr
2. **Accumulés** pour le résultat final
3. **Parsés** si nécessaire (pour les outils qui retournent du JSON)
4. **Sauvegardés** dans la base de données Convex

---

## 🚨 ERROR HANDLING

### Types d'Erreurs

| Type | Description | Handling |
|------|-------------|----------|
| Command Not Found | Commande non trouvée | Message d'erreur + suggestion |
| Permission Denied | Permission refusée | Message d'erreur + suggestion d'utiliser `--dangerously-skip-permissions` |
| File Not Found | Fichier non trouvé | Message d'erreur + vérification du path |
| Timeout | Commande trop longue | Timeout après 15 min (configurable) |
| Network Error | Problème réseau | Retry automatique |
| Parse Error | Erreur de parsing | Log + skip |
| Unknown Tool | Outil inconnu | Message d'erreur + liste des outils disponibles |

### Exemple de Handling

```typescript
// Dans processStdoutLine
else if (parsedData.type === "tool_call") {
  const { name, arguments } = parsedData;
  
  try {
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
    // ...
  } catch (error: any) {
    console.error("Error executing tool:", name, error);
    
    // Message d'erreur
    await addMessage(id, JSON.stringify({
      type: "tool_error",
      name,
      arguments,
      error: {
        message: error.message || String(error),
        code: error.code,
      },
    }), "assistant", eventTimestamp);
  }
}
```

### Sanitization des Erreurs

Avant d'afficher les erreurs, Vibra **sanitize** les secrets:

```typescript
const secretPatterns = [
  /sk-ant-[a-zA-Z0-9-]+/g,        // Anthropic API keys
  /sk-[a-zA-Z0-9-]{20,}/g,        // Stripe API keys
  /ghp_[a-zA-Z0-9]+/g,            // GitHub tokens
  /gho_[a-zA-Z0-9]+/g,            // GitHub OAuth tokens
  /xai-[a-zA-Z0-9-]+/g,           // XAI API keys
  /Bearer\s+[a-zA-Z0-9._-]+/gi,    // Bearer tokens
  /Authorization:\s*[^\s,}]+/gi, // Authorization headers
  /api[_-]?key["\s:=]+[a-zA-Z0-9._-]+/gi, // API keys
  /token["\s:=]+[a-zA-Z0-9._-]+/gi,     // Tokens
  /secret["\s:=]+[a-zA-Z0-9._-]+/gi,    // Secrets
  /password["\s:=]+[^\s,}]+/gi,       // Passwords
];

let sanitizedError = errorMessage;
for (const pattern of secretPatterns) {
  sanitizedError = sanitizedError.replace(pattern, '[REDACTED]');
}
```

---

## 📋 TOOL RESULT PROCESSING

### Traitement des Résultats

**Source**: `lib/inngest/functions/run-agent.ts`

```typescript
// Après exécution d'un outil
const result = await e2bManager.executeCommand(command, {
  onStdout: (data) => handleStdout(data),
  onStderr: (data) => handleStderr(data),
});

// Sauvegarde du résultat dans Convex
await addMessage(id, JSON.stringify({
  type: "tool_result",
  name: toolName,
  arguments: toolArguments,
  result: {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  },
  timestamp: eventTimestamp,
}), "assistant", eventTimestamp);

// Mise à jour du statut de la session
await updateSessionStatus(id, "CUSTOM", `Executed: ${toolName}`);
```

### Format des Résultats

Les résultats sont sauvegardés au format:

```json
{
  "type": "tool_result",
  "name": "bash",
  "arguments": {
    "command": "ls -la"
  },
  "result": {
    "stdout": "file1.txt\nfile2.txt\n",
    "stderr": "",
    "exitCode": 0
  },
  "timestamp": 1700000000000
}
```

### Affichage dans l'UI

Les résultats sont affichés dans le chat sous forme de **Tool Cards**:

```
┌─────────────────────────────────────┐
│  ✅ bash                              │
│  Command: ls -la                      │
│  Exit Code: 0                        │
│  ┌─────────────────────────────────┐│
│  │  file1.txt                       ││
│  │  file2.txt                       ││
│  │  folder1/                        ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| Tool Definitions | JSON Stream | ? | ⭐⭐ |
| Tool Execution | E2B Sandbox | ExecutionProvider | ⭐⭐⭐⭐ |
| Tool Registry | Implicit | ToolRegistry | ⭐⭐⭐ |
| Tool Streaming | ✅ | ⭐ | ⭐ |
| Tool Error Handling | ✅ | ⭐ | ⭐ |
| Filesystem Tools | ✅ | ✅ | ⭐⭐⭐⭐ |
| Terminal Tools | ✅ | ✅ | ⭐⭐⭐⭐ |
| Git Tools | ✅ | ✅ | ⭐⭐⭐⭐ |
| GitHub Tools | ✅ | ✅ | ⭐⭐⭐ |
| Project Tools | ✅ | ✅ | ⭐⭐⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| Tool Definition | JSON Stream (implicite) | Explicite (Tool trait) | **Adapter** |
| Tool Calling | Via Agent JSON output | Via ToolRegistry | **Intégrer** |
| Tool Execution | Direct dans E2B | Via ExecutionProvider | **Adapter** |
| Tool Streaming | Full support | À implémenter | **Ajouter** |
| Tool Results | JSON format | À standardiser | **Standardiser** |

### Avantages Vibra à Extraire

1. **JSON Stream Format**: Format efficace pour la communication agent ↔ tools
2. **Tool Calling via Agent**: L'agent appelle les outils directement
3. **Streaming Results**: Résultats streamés en temps réel
4. **Error Handling**: Très robuste avec sanitization
5. **Tool Card Display**: Affichage clair des résultats

### Points à Améliorer dans SoryOS

1. **Tool Calling**: Doit supporter le tool calling comme Vibra
2. **Tool Streaming**: Doit streamer les résultats en temps réel
3. **Tool Results**: Doit standardiser le format des résultats
4. **Tool Error Handling**: Doit être aussi robuste que Vibra
5. **Tool Cards**: Doit afficher les résultats comme Vibra

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. ToolRegistry (⭐⭐⭐⭐⭐)

**À Étendre**:
```rust
// packages/tools/src/registry.rs

pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn Tool>>,
    execution_provider: ExecutionProvider,
}

impl ToolRegistry {
    pub fn new(execution_provider: ExecutionProvider) -> Self {
        let mut registry = Self {
            tools: HashMap::new(),
            execution_provider,
        };
        
        // Enregistrement des outils de base
        registry.register("bash".to_string(), Box::new(BashTool::new(execution_provider.clone())));
        registry.register("read".to_string(), Box::new(ReadTool::new(execution_provider.clone())));
        registry.register("write".to_string(), Box::new(WriteTool::new(execution_provider.clone())));
        registry.register("edit".to_string(), Box::new(EditTool::new(execution_provider.clone())));
        registry.register("git".to_string(), Box::new(GitTool::new(execution_provider.clone())));
        registry.register("github".to_string(), Box::new(GitHubTool::new()));
        
        registry
    }
    
    pub fn register(&mut self, name: String, tool: Box<dyn Tool>) {
        self.tools.insert(name, tool);
    }
    
    pub fn get(&self, name: &str) -> Option<&Box<dyn Tool>> {
        self.tools.get(name)
    }
    
    pub fn list(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }
    
    pub async fn execute(&self, name: &str, args: serde_json::Value) -> Result<ToolResult, ToolError> {
        if let Some(tool) = self.tools.get(name) {
            tool.execute(args).await
        } else {
            Err(ToolError::UnknownTool(name.to_string()))
        }
    }
    
    pub async fn execute_from_agent(&self, tool_call: ToolCall) -> Result<ToolResult, ToolError> {
        self.execute(&tool_call.name, tool_call.arguments).await
    }
}
```

#### 2. Tool Trait (⭐⭐⭐⭐⭐)

**À Définir**:
```rust
// packages/tools/src/trait.rs

pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn category(&self) -> ToolCategory;
    fn parameters(&self) -> &ToolParameters;
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send>;
    fn supports_streaming(&self) -> bool {
        false
    }
    fn stream(&self, args: serde_json::Value) -> Box<dyn Stream<Item = String> + Send>;
}

#[derive(Debug, Clone)]
pub enum ToolCategory {
    Filesystem,
    Terminal,
    Git,
    GitHub,
    Project,
    Preview,
    Environment,
    System,
    Network,
    FileTransfer,
}

#[derive(Debug, Clone)]
pub struct ToolParameters {
    pub required: Vec<String>,
    pub optional: Vec<String>,
    pub properties: HashMap<String, ToolParameter>,
}

#[derive(Debug, Clone)]
pub struct ToolParameter {
    pub r#type: String, // "string", "number", "boolean", "array", "object"
    pub description: String,
    pub default: Option<serde_json::Value>,
}

#[derive(Debug)]
pub struct ToolResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug)]
pub enum ToolError {
    UnknownTool(String),
    InvalidArguments(String),
    ExecutionError(String),
    PermissionDenied(String),
    NotFound(String),
    Timeout,
    NetworkError(String),
}
```

#### 3. Implémentations des Outils (⭐⭐⭐⭐⭐)

**BashTool**:
```rust
// packages/tools/src/definitions/terminal.rs

pub struct BashTool {
    execution_provider: ExecutionProvider,
}

impl BashTool {
    pub fn new(execution_provider: ExecutionProvider) -> Self {
        Self { execution_provider }
    }
}

impl Tool for BashTool {
    fn name(&self) -> &str {
        "bash"
    }
    
    fn description(&self) -> &str {
        "Execute a shell command"
    }
    
    fn category(&self) -> ToolCategory {
        ToolCategory::Terminal
    }
    
    fn parameters(&self) -> &ToolParameters {
        static PARAMS: OnceCell<ToolParameters> = OnceCell::new();
        PARAMS.get_or_init(|| ToolParameters {
            required: vec!["command".to_string()],
            optional: vec![],
            properties: [("command".to_string(), ToolParameter {
                r#type: "string".to_string(),
                description: "The shell command to execute".to_string(),
                default: None,
            })].into_iter().collect(),
        })
    }
    
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send> {
        let execution_provider = self.execution_provider.clone();
        let command = args["command"].as_str().ok_or(ToolError::InvalidArguments("command is required".to_string()));
        
        Box::new(async move {
            match command {
                Ok(cmd) => {
                    let result = execution_provider.execute(cmd).await?;
                    Ok(ToolResult {
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exit_code: result.exit_code,
                        metadata: HashMap::new(),
                    })
                }
                Err(e) => Err(e),
            }
        })
    }
    
    fn supports_streaming(&self) -> bool {
        true
    }
    
    fn stream(&self, args: serde_json::Value) -> Box<dyn Stream<Item = String> + Send> {
        let execution_provider = self.execution_provider.clone();
        let command = args["command"].as_str().unwrap_or("").to_string();
        
        let (tx, rx) = mpsc::channel(100);
        
        tokio::spawn(async move {
            if let Ok(result) = execution_provider.stream(&command).await {
                for chunk in result {
                    if tx.send(chunk).await.is_err() {
                        break;
                    }
                }
            }
        });
        
        Box::new(UnboundedReceiverStream::new(rx))
    }
}
```

**ReadTool**:
```rust
pub struct ReadTool {
    execution_provider: ExecutionProvider,
}

impl ReadTool {
    pub fn new(execution_provider: ExecutionProvider) -> Self {
        Self { execution_provider }
    }
}

impl Tool for ReadTool {
    fn name(&self) -> &str {
        "read"
    }
    
    fn description(&self) -> &str {
        "Read the contents of a file"
    }
    
    fn category(&self) -> ToolCategory {
        ToolCategory::Filesystem
    }
    
    fn parameters(&self) -> &ToolParameters {
        static PARAMS: OnceCell<ToolParameters> = OnceCell::new();
        PARAMS.get_or_init(|| ToolParameters {
            required: vec!["filePath".to_string()],
            optional: vec![],
            properties: [("filePath".to_string(), ToolParameter {
                r#type: "string".to_string(),
                description: "Path to the file to read".to_string(),
                default: None,
            })].into_iter().collect(),
        })
    }
    
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send> {
        let execution_provider = self.execution_provider.clone();
        let file_path = args["filePath"].as_str().ok_or(ToolError::InvalidArguments("filePath is required".to_string()));
        
        Box::new(async move {
            match file_path {
                Ok(path) => {
                    let result = execution_provider.read_file(path).await?;
                    Ok(ToolResult {
                        stdout: result.content,
                        stderr: String::new(),
                        exit_code: 0,
                        metadata: [("filePath".to_string(), serde_json::Value::String(path.to_string()))]
                            .into_iter().collect(),
                    })
                }
                Err(e) => Err(e),
            }
        })
    }
}
```

**WriteTool**:
```rust
pub struct WriteTool {
    execution_provider: ExecutionProvider,
}

impl WriteTool {
    pub fn new(execution_provider: ExecutionProvider) -> Self {
        Self { execution_provider }
    }
}

impl Tool for WriteTool {
    fn name(&self) -> &str {
        "write"
    }
    
    fn description(&self) -> &str {
        "Write content to a file"
    }
    
    fn category(&self) -> ToolCategory {
        ToolCategory::Filesystem
    }
    
    fn parameters(&self) -> &ToolParameters {
        static PARAMS: OnceCell<ToolParameters> = OnceCell::new();
        PARAMS.get_or_init(|| ToolParameters {
            required: vec!["filePath".to_string(), "content".to_string()],
            optional: vec![],
            properties: [
                ("filePath".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Path to the file to write".to_string(),
                    default: None,
                }),
                ("content".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Content to write to the file".to_string(),
                    default: None,
                }),
            ].into_iter().collect(),
        })
    }
    
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send> {
        let execution_provider = self.execution_provider.clone();
        let file_path = args["filePath"].as_str().ok_or(ToolError::InvalidArguments("filePath is required".to_string()));
        let content = args["content"].as_str().ok_or(ToolError::InvalidArguments("content is required".to_string()));
        
        Box::new(async move {
            match (file_path, content) {
                (Ok(path), Ok(content)) => {
                    execution_provider.write_file(path, content).await?;
                    Ok(ToolResult {
                        stdout: format!("File {} written successfully", path),
                        stderr: String::new(),
                        exit_code: 0,
                        metadata: [
                            ("filePath".to_string(), serde_json::Value::String(path.to_string())),
                            ("bytesWritten".to_string(), serde_json::Value::Number(content.len().into())),
                        ].into_iter().collect(),
                    })
                }
                _ => Err(ToolError::InvalidArguments("filePath and content are required".to_string())),
            }
        })
    }
}
```

**EditTool**:
```rust
pub struct EditTool {
    execution_provider: ExecutionProvider,
}

impl EditTool {
    pub fn new(execution_provider: ExecutionProvider) -> Self {
        Self { execution_provider }
    }
}

impl Tool for EditTool {
    fn name(&self) -> &str {
        "edit"
    }
    
    fn description(&self) -> &str {
        "Edit a file by replacing old string with new string"
    }
    
    fn category(&self) -> ToolCategory {
        ToolCategory::Filesystem
    }
    
    fn parameters(&self) -> &ToolParameters {
        static PARAMS: OnceCell<ToolParameters> = OnceCell::new();
        PARAMS.get_or_init(|| ToolParameters {
            required: vec!["filePath".to_string(), "oldString".to_string(), "newString".to_string()],
            optional: vec![],
            properties: [
                ("filePath".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Path to the file to edit".to_string(),
                    default: None,
                }),
                ("oldString".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "The string to replace".to_string(),
                    default: None,
                }),
                ("newString".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "The new string".to_string(),
                    default: None,
                }),
            ].into_iter().collect(),
        })
    }
    
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send> {
        let execution_provider = self.execution_provider.clone();
        let file_path = args["filePath"].as_str().ok_or(ToolError::InvalidArguments("filePath is required".to_string()));
        let old_string = args["oldString"].as_str().ok_or(ToolError::InvalidArguments("oldString is required".to_string()));
        let new_string = args["newString"].as_str().ok_or(ToolError::InvalidArguments("newString is required".to_string()));
        
        Box::new(async move {
            match (file_path, old_string, new_string) {
                (Ok(path), Ok(old), Ok(new)) => {
                    let result = execution_provider.edit_file(path, old, new).await?;
                    Ok(ToolResult {
                        stdout: format!("File {} edited successfully", path),
                        stderr: String::new(),
                        exit_code: 0,
                        metadata: [
                            ("filePath".to_string(), serde_json::Value::String(path.to_string())),
                            ("replacements".to_string(), serde_json::Value::Number(result.replacements.into())),
                        ].into_iter().collect(),
                    })
                }
                _ => Err(ToolError::InvalidArguments("filePath, oldString, and newString are required".to_string())),
            }
        })
    }
}
```

#### 4. GitTool (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
pub struct GitTool {
    execution_provider: ExecutionProvider,
}

impl GitTool {
    pub fn new(execution_provider: ExecutionProvider) -> Self {
        Self { execution_provider }
    }
}

impl Tool for GitTool {
    fn name(&self) -> &str {
        "git"
    }
    
    fn description(&self) -> &str {
        "Execute git commands"
    }
    
    fn category(&self) -> ToolCategory {
        ToolCategory::Git
    }
    
    fn parameters(&self) -> &ToolParameters {
        static PARAMS: OnceCell<ToolParameters> = OnceCell::new();
        PARAMS.get_or_init(|| ToolParameters {
            required: vec!["command".to_string()],
            optional: vec!["args".to_string()],
            properties: [
                ("command".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Git command: status, add, commit, push, pull, clone, branch, log, diff".to_string(),
                    default: None,
                }),
                ("args".to_string(), ToolParameter {
                    r#type: "object".to_string(),
                    description: "Additional arguments for the command".to_string(),
                    default: Some(serde_json::Value::Object(serde_json::Map::new())),
                }),
            ].into_iter().collect(),
        })
    }
    
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send> {
        let execution_provider = self.execution_provider.clone();
        let command = args["command"].as_str().ok_or(ToolError::InvalidArguments("command is required".to_string()));
        let git_args = args["args"].clone().unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
        
        Box::new(async move {
            match command {
                Ok(cmd) => {
                    let git_command = match cmd {
                        "status" => self.build_status_command(&git_args),
                        "add" => self.build_add_command(&git_args),
                        "commit" => self.build_commit_command(&git_args),
                        "push" => self.build_push_command(&git_args),
                        "pull" => self.build_pull_command(&git_args),
                        "clone" => self.build_clone_command(&git_args),
                        "branch" => self.build_branch_command(&git_args),
                        "log" => self.build_log_command(&git_args),
                        "diff" => self.build_diff_command(&git_args),
                        _ => return Err(ToolError::InvalidArguments(format!("Unknown git command: {}", cmd))),
                    };
                    
                    let result = execution_provider.execute(&git_command).await?;
                    Ok(ToolResult {
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exit_code: result.exit_code,
                        metadata: [("gitCommand".to_string(), serde_json::Value::String(git_command))]
                            .into_iter().collect(),
                    })
                }
                Err(e) => Err(e),
            }
        })
    }
    
    fn build_status_command(&self, args: &serde_json::Value) -> String {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
        format!("git status {}", path)
    }
    
    fn build_add_command(&self, args: &serde_json::Value) -> String {
        let files = args.get("files").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        if files.is_empty() {
            "git add .".to_string()
        } else {
            format!("git add {}", files.join(" "))
        }
    }
    
    fn build_commit_command(&self, args: &serde_json::Value) -> String {
        let message = args.get("message").and_then(|v| v.as_str()).unwrap_or("");
        let files = args.get("files").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        
        let mut command = format!("git commit -m \"{}\"", message.replace('"', "\\\""));
        if !files.is_empty() {
            command = format!("git add {} && {}", files.join(" "), command);
        }
        command
    }
    
    // ... autres méthodes build_*
}
```

#### 5. GitHubTool (⭐⭐⭐⭐)

**À Implémenter**:
```rust
pub struct GitHubTool {
    github_manager: GitHubManager,
}

impl GitHubTool {
    pub fn new(github_manager: GitHubManager) -> Self {
        Self { github_manager }
    }
}

impl Tool for GitHubTool {
    fn name(&self) -> &str {
        "github"
    }
    
    fn description(&self) -> &str {
        "GitHub integration: push, pull request, etc."
    }
    
    fn category(&self) -> ToolCategory {
        ToolCategory::GitHub
    }
    
    fn parameters(&self) -> &ToolParameters {
        static PARAMS: OnceCell<ToolParameters> = OnceCell::new();
        PARAMS.get_or_init(|| ToolParameters {
            required: vec!["action".to_string()],
            optional: vec!["repository".to_string(), "message".to_string(), "title".to_string(), "description".to_string()],
            properties: [
                ("action".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "GitHub action: push, pr, fork, issue".to_string(),
                    default: None,
                }),
                ("repository".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Repository name (owner/repo)".to_string(),
                    default: None,
                }),
                ("message".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Commit message for push".to_string(),
                    default: None,
                }),
                ("title".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Title for PR or issue".to_string(),
                    default: None,
                }),
                ("description".to_string(), ToolParameter {
                    r#type: "string".to_string(),
                    description: "Description for PR or issue".to_string(),
                    default: None,
                }),
            ].into_iter().collect(),
        })
    }
    
    fn execute(&self, args: serde_json::Value) -> Box<dyn Future<Output = Result<ToolResult, ToolError>> + Send> {
        let github_manager = self.github_manager.clone();
        let action = args["action"].as_str().ok_or(ToolError::InvalidArguments("action is required".to_string()));
        
        Box::new(async move {
            match action {
                Ok("push") => {
                    let repository = args["repository"].as_str().ok_or(ToolError::InvalidArguments("repository is required for push".to_string()))?;
                    let message = args["message"].as_str().unwrap_or("Commit from SoryOS");
                    
                    let result = github_manager.commit_and_push(repository, message).await?;
                    Ok(ToolResult {
                        stdout: format!("Pushed to {}", repository),
                        stderr: String::new(),
                        exit_code: 0,
                        metadata: [
                            ("action".to_string(), serde_json::Value::String("push".to_string())),
                            ("repository".to_string(), serde_json::Value::String(repository.to_string())),
                            ("success".to_string(), serde_json::Value::Bool(result.success)),
                        ].into_iter().collect(),
                    })
                }
                Ok("pr") => {
                    let repository = args["repository"].as_str().ok_or(ToolError::InvalidArguments("repository is required for PR".to_string()))?;
                    let title = args["title"].as_str().unwrap_or("SoryOS PR");
                    let description = args["description"].as_str().unwrap_or("");
                    
                    let pr = github_manager.create_pull_request(repository, title, description).await?;
                    Ok(ToolResult {
                        stdout: format!("PR created: {}", pr.html_url),
                        stderr: String::new(),
                        exit_code: 0,
                        metadata: [
                            ("action".to_string(), serde_json::Value::String("pr".to_string())),
                            ("url".to_string(), serde_json::Value::String(pr.html_url)),
                        ].into_iter().collect(),
                    })
                }
                Ok(_) => Err(ToolError::InvalidArguments(format!("Unknown GitHub action: {}", action.unwrap_or("")))),
                Err(e) => Err(e),
            }
        })
    }
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: Tool System Foundation (Priorité ⭐⭐⭐⭐⭐)

1. **Définir le Tool Trait**
   - Créer `packages/tools/src/trait.rs`
   - Définir les interfaces de base
   - Tester avec des mocks

2. **Créer le ToolRegistry**
   - Créer `packages/tools/src/registry.rs`
   - Implémenter register, get, list, execute
   - Tester avec des outils mock

3. **Intégrer avec ExecutionProvider**
   - Adapter ExecutionProvider pour supporter les outils
   - Tester la connexion

### Phase 2: Implémentation des Outils (Priorité ⭐⭐⭐⭐⭐)

4. **Implémenter BashTool**
   - Créer `packages/tools/src/definitions/terminal.rs`
   - Tester avec des commandes simples

5. **Implémenter Filesystem Tools**
   - ReadTool, WriteTool, EditTool, SearchTool, ListTool, DeleteTool
   - Tester chaque outil

6. **Implémenter GitTool**
   - Créer `packages/tools/src/definitions/git.rs`
   - Tester chaque commande git

7. **Implémenter GitHubTool**
   - Créer `packages/tools/src/definitions/github.rs`
   - Tester push et PR

### Phase 3: Intégration avec Agent (Priorité ⭐⭐⭐⭐)

8. **Intégrer ToolRegistry avec AgentRuntime**
   - Lier ToolRegistry à AgentRuntime
   - Tester le tool calling depuis l'agent

9. **Ajouter le Streaming Support**
   - Implémenter le streaming pour les outils
   - Tester avec des commandes longues

10. **Standardiser les Résultats**
    - Définir le format des résultats
    - Tester l'affichage dans l'UI

---

## 📚 RÉFÉRENCES

- [Vibra Code Run Agent](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/run-agent.ts)
- [Vibra Code E2B Config](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/e2b/config.ts)
- [Vibra Code Prompts](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/prompts.ts)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
