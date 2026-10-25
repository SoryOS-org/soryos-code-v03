# Vibra Code - Sandbox System Analysis

> **Projet**: Extraction du Sandbox System de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [Sandbox Architecture](#-sandbox-architecture)
3. [Sandbox Creation](#-sandbox-creation)
4. [Sandbox Connection](#-sandbox-connection)
5. [Sandbox Configuration](#-sandbox-configuration)
6. [Working Directory](#-working-directory)
7. [Session Token](#-session-token)
8. [Environment Files](#-environment-files)
9. [Startup Script](#-startup-script)
10. [Sandbox Lifecycle](#-sandbox-lifecycle)
11. [Sandbox State Management](#-sandbox-state-management)
12. [Error Handling](#-error-handling)
13. [Comparison avec SoryOS](#-comparison-avec-soryos)
14. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture du Sandbox System

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VIBRA CODE SANDBOX SYSTEM                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   E2B       │    │  SANDBOX    │    │  TEMPLATE   │              │
│  │   SDK       │───►│  INSTANCE   │◄───│  CONFIG     │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SANDBOX CREATION                             │   │
│  │  1. Sandbox.betaCreate() with template                         │   │
│  │  2. autoPause: true                                             │   │
│  │  3. timeoutMs: 900000 (15 min)                                  │   │
│  │  4. envs: template secrets + user envs                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    STARTUP SCRIPT                               │   │
│  │  - Run on sandbox creation                                     │   │
│  │  - Generate session token                                       │   │
│  │  - Write /vibe0/.session_token                                 │   │
│  │  - Write /vibe0/.env.local                                      │   │
│  │  - Write /vibe0/.expo_env                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    WORKING DIRECTORY                            │   │
│  │  /vibe0/                                                        │   │
│  │    ├── .session_token     (Session token)                       │   │
│  │    ├── .env.local         (Environment variables)               │   │
│  │    ├── .expo_env          (Expo environment)                     │   │
│  │    ├── .env               (Additional environment)               │   │
│  │    ├── .git/             (Git repository)                       │   │
│  │    ├── package.json       (Project configuration)               │   │
│  │    ├── node_modules/     (Dependencies)                         │   │
│  │    └── src/              (Source code)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SANDBOX CONNECTION                            │   │
│  │  - Sandbox.connect(sandboxId)                                   │   │
│  │  - auto-resume if paused                                        │   │
│  │  - Reset timeout                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `lib/e2b/config.ts` | Sandbox management | ⭐⭐⭐⭐⭐ | 700+ |
| `vibracode-backend/config.ts` | Template configuration | ⭐⭐⭐⭐ | 200+ |
| `e2b-cursor-template/` | Template E2B | ⭐⭐⭐ | N/A |

---

## 🏗️ SANDBOX ARCHITECTURE

### Concepts de Base

Dans Vibra Code, une **sandbox** est:

1. **Un conteneur Docker** isolé et éphémère
2. **Un environnement d'exécution** pour le code
3. **Un espace de travail** avec filesystem persistant pendant la session
4. **Un point d'accès** pour l'exécution de commandes

### Caractéristiques Principales

| Caractéristique | Description | Valeur |
|----------------|-------------|-------|
| Isolation | Chaque sandbox est isolée des autres | ✅ |
| Éphémère | Les sandboxes sont détruites après inactivité | ✅ |
| Auto-Pause | Pause automatique après 15 min d'inactivité | ✅ |
| Streaming | Support du streaming stdout/stderr | ✅ |
| Filesystem | Accès complet au filesystem | ✅ |
| Network | Accès réseau (avec restrictions) | ✅ |
| Port Forwarding | Forwarding de ports pour preview | ✅ |
| Environment | Variables d'environnement configurables | ✅ |

### Working Directory

**Chemin**: `/vibe0/`

C'est le **working directory** par défaut dans toutes les sandboxes Vibra.

```
/vibe0/
├── .session_token       # Token de session unique
├── .env.local           # Variables d'environnement (format .env)
├── .expo_env            # Variables d'environnement (format shell)
├── .env                 # Variables d'environnement supplémentaires
├── .git/                # Repository Git
├── package.json         # Configuration du projet
├── node_modules/        # Dependencies npm/yarn/pnpm
├── src/                 # Code source
└── ...                  # Autres fichiers
```

---

## 🆕 SANDBOX CREATION

### Flow de Création

```
START
  │
  ▼
┌─────────────────────┐
│  Validate API Key    │  (E2B_API_KEY doit être défini)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Select Template     │  (E2B template ID)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Prepare Env Vars    │  (template.secrets + user envs)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Call Sandbox.       │
│  betaCreate()        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Wait for Sandbox    │  (Création du conteneur)
│  Ready              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Wait for Startup    │  (Exécution du script de démarrage)
│  Script             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Check Session       │  (Vérifier /vibe0/.session_token)
│  Token              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Generate Token if   │  (Si non trouvé)
│  Missing            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Write Env Files    │  (.env.local, .expo_env)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandbox Ready      │
└─────────────────────┘
```

### Code de Création

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
  // /vibe0/ est le working directory path dans le template E2B
  let sessionToken = '';
  for (let i = 0; i < 25; i++) { // 25 * 200ms = 5s max
    try {
      const result = await sandbox.commands.run('cat /vibe0/.session_token 2>/dev/null');
      sessionToken = result.stdout.trim();
      if (sessionToken && sessionToken.length >= 32) break;
    } catch {}
    await new Promise(r => setTimeout(r, 200)); // Polling rapide
  }

  // Générer un token si non trouvé
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

### Paramètres de Création

```typescript
interface CreateSandboxOptions {
  apiKey: string;           // E2B API key
  templateId: string;       // E2B template ID
  envs: Record<string, string>; // Variables d'environnement
  autoPause: boolean;       // Active l'auto-pause (default: true)
  timeoutMs: number;        // Timeout en ms (default: 900000 = 15 min)
}
```

---

## 🔗 SANDBOX CONNECTION

### Flow de Connexion

```
START
  │
  ▼
┌─────────────────────┐
│  Check if Already     │  (Déjà connecté à cette sandbox?)
│  Connected           │
└──────────┬──────────┘
           │
           ▼ (Non)
┌─────────────────────┐
│  Call Sandbox.       │
│  connect()           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Auto-Resume if      │  (Si la sandbox était paused)
│  Paused             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Reset Timeout       │  (Reset du timer auto-pause)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandbox Connected   │
└─────────────────────┘
```

### Code de Connexion

**Source**: `lib/e2b/config.ts` (E2BManager.connectToSandbox)

```typescript
async connectToSandbox(sandboxId: string): Promise<Sandbox> {
  if (this.sandbox && this.sandboxId === sandboxId) {
    console.log('⚠️ Already connected to this sandbox');
    return this.sandbox;
  }

  console.log(`🔄 Connecting to existing sandbox: ${sandboxId}`);

  // Import dynamique pour éviter les dépendances circulaires
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

## ⚙️ SANDBOX CONFIGURATION

### Configuration par Défaut

```typescript
// Configuration par défaut dans Vibra
const DEFAULT_CONFIG: E2BSandboxConfig = {
  templateId: "YOUR_E2B_TEMPLATE_ID",
  apiKey: process.env.E2B_API_KEY,
  envVars: {},
  timeout: parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000') // 15 min
};
```

### Configuration via Variables d'Environnement

```bash
# E2B API Key
E2B_API_KEY=your_e2b_api_key

# Timeout auto-pause (en millisecondes)
AUTO_PAUSE_TIMEOUT_MS=900000  # 15 minutes

# API Keys des providers
ANTHROPIC_SANDBOX_API_KEY=your_anthropic_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
CURSOR_AGENT_API_KEY=your_cursor_api_key
GEMINI_API_KEY=your_gemini_api_key
```

### Configuration par Template

```typescript
// Chaque template peut avoir ses propres secrets
const templates: Template[] = [
  {
    id: "blank",
    name: "Blank App",
    image: "e2b-template-blank-expo",
    secrets: {
      // Pas de secrets par défaut pour le template blank
    },
    startCommands: [...]
  },
  {
    id: "react-native",
    name: "React Native",
    image: "e2b-template-react-native",
    secrets: {
      // Secrets spécifiques au template
      REACT_NATIVE_API_KEY: "default-key",
    },
    startCommands: [...]
  }
];
```

---

## 📁 WORKING DIRECTORY

### Structure du Working Directory

**Chemin**: `/vibe0/`

```
/vibe0/
├── .session_token           # Token de session (32+ caractères hex)
├── .env.local               # Variables d'environnement (format .env)
├── .expo_env                # Variables d'environnement (format shell)
├── .env                     # Variables d'environnement supplémentaires
├── .git/                    # Repository Git
│   ├── config
│   ├── HEAD
│   └── ...
├── .gitignore               # Fichiers à ignorer
├── package.json             # Configuration npm
├── node_modules/            # Dependencies
├── public/                  # Fichiers publics
├── src/                     # Code source
│   ├── App.tsx
│   ├── index.tsx
│   └── ...
├── assets/                  # Assets (images, fonts)
└── ...
```

### Fichiers Spéciaux

#### 1. .session_token

**Chemin**: `/vibe0/.session_token`

**Contenu**: Token unique de 32+ caractères hexadécimaux

**Utilisation**:
- Identification de la session
- Communication entre le client et la sandbox
- Authentification des requêtes

**Génération**:
```typescript
// Si non trouvé après le startup script
const sessionToken = crypto.randomBytes(32).toString('hex');
await sandbox.files.write('/vibe0/.session_token', sessionToken);
```

#### 2. .env.local

**Chemin**: `/vibe0/.env.local`

**Format**: Fichier .env standard (KEY=value)

**Contenu**:
```
EXPO_PUBLIC_PROJECT_ID=sandbox-1234567890abcdef
EXPO_PUBLIC_SESSION_TOKEN=abcdef1234567890abcdef1234567890
# Autres variables d'environnement...
```

**Utilisation**:
- Configuration de l'application
- Accès aux variables d'environnement dans le code
- Utilisé par Expo et React Native

#### 3. .expo_env

**Chemin**: `/vibe0/.expo_env`

**Format**: Fichier shell (export KEY=value)

**Contenu**:
```bash
export EXPO_PUBLIC_PROJECT_ID=sandbox-1234567890abcdef
export EXPO_PUBLIC_SESSION_TOKEN=abcdef1234567890abcdef1234567890
# Autres variables...
```

**Utilisation**:
- Configuration des variables d'environnement dans le shell
- Utilisé par les scripts shell dans la sandbox

---

## 🔐 SESSION TOKEN

### Génération

```typescript
// Méthode 1: Généré par le startup script du template
// Le template E2B peut avoir un script qui génère le token

// Méthode 2: Généré manuellement si non trouvé
if (!sessionToken || sessionToken.length < 32) {
  sessionToken = crypto.randomBytes(32).toString('hex');
  await sandbox.files.write('/vibe0/.session_token', sessionToken);
}
```

### Utilisation

```typescript
// Dans les fichiers .env
const envContent = `EXPO_PUBLIC_PROJECT_ID=${sandbox.sandboxId}\nEXPO_PUBLIC_SESSION_TOKEN=${sessionToken}`;

// Dans les requêtes API
const token = await sandbox.files.read('/vibe0/.session_token');

// Pour l'authentification
if (request.sessionToken !== sessionToken) {
  throw new Error('Unauthorized');
}
```

---

## 📝 ENVIRONMENT FILES

### Écriture des Fichiers

```typescript
// Dans createE2BSandbox
if (needsEnvWrite) {
  const envContent = `EXPO_PUBLIC_PROJECT_ID=${sandbox.sandboxId}\nEXPO_PUBLIC_SESSION_TOKEN=${sessionToken}`;
  const expoEnvContent = `export EXPO_PUBLIC_PROJECT_ID=${sandbox.sandboxId}\nexport EXPO_PUBLIC_SESSION_TOKEN=${sessionToken}`;
  
  await sandbox.files.write('/vibe0/.env.local', envContent);
  await sandbox.files.write('/vibe0/.expo_env', expoEnvContent);
  
  console.log(`📁 Injected sandbox ID into .env.local and .expo_env: ${sandbox.sandboxId}`);
}
```

### Contenu des Fichiers

**Variables par Défaut**:
```
EXPO_PUBLIC_PROJECT_ID=<sandbox-id>
EXPO_PUBLIC_SESSION_TOKEN=<session-token>
```

**Variables Ajoutées**:
- Variables du template (`template.secrets`)
- Variables utilisateur (`session.envs`)
- Variables système (Node.js, npm, etc.)

---

## 🚀 STARTUP SCRIPT

### Mécanisme

Les templates E2B peuvent inclure un **startup script** qui est exécuté automatiquement lors de la création de la sandbox.

Dans Vibra, ce script:
1. Génère un `session_token` unique
2. Écrit le token dans `/vibe0/.session_token`
3. Configure l'environnement
4. Installe les dépendances si nécessaire

### Détection du Startup Script

```typescript
// Vérification si le startup script a déjà configuré les fichiers
let needsEnvWrite = true;
try {
  const existing = await sandbox.commands.run('cat /vibe0/.env.local 2>/dev/null');
  if (existing.stdout.includes(sandbox.sandboxId) && existing.stdout.includes(sessionToken)) {
    needsEnvWrite = false;
    console.log('📁 Env files already configured by startup script');
  }
} catch {}
```

### Exemple de Startup Script

```bash
#!/bin/bash

# Générer un session token
SESSION_TOKEN=$(openssl rand -hex 32)
echo "$SESSION_TOKEN" > /vibe0/.session_token

# Configurer l'environnement
echo "EXPO_PUBLIC_PROJECT_ID=${SANDBOX_ID}" > /vibe0/.env.local
echo "EXPO_PUBLIC_SESSION_TOKEN=$SESSION_TOKEN" >> /vibe0/.env.local

echo "export EXPO_PUBLIC_PROJECT_ID=${SANDBOX_ID}" > /vibe0/.expo_env
echo "export EXPO_PUBLIC_SESSION_TOKEN=$SESSION_TOKEN" >> /vibe0/.expo_env

# Installer les dépendances si nécessaire
if [ -f "/vibe0/package.json" ]; then
  cd /vibe0
  npm install
fi
```

---

## 🔄 SANDBOX LIFECYCLE

### États de la Sandbox

```
CREATION
  │
  ▼
┌─────────────────────┐
│  Sandbox.betaCreate()│  (Création du conteneur)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Running Startup     │  (Exécution du script de démarrage)
│  Script             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Ready              │  (Prête à recevoir des commandes)
└──────────┬──────────┘
           │
           ▼
CONNECTED
  │
  ▼
┌─────────────────────┐
│  Executing          │  (Exécution de commandes)
│  Commands           │
└──────────┬──────────┘
           │
           ▼
IDLE
  │
  ▼ (après timeout)
┌─────────────────────┐
│  Auto-Paused        │  (Pause automatique après inactivité)
└──────────┬──────────┘
           │
           ▼ (sur nouvelle requête)
┌─────────────────────┐
│  Resuming           │  (Reprise de la sandbox)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Connected          │  (Retour à l'état connected)
└──────────┬──────────┘
           │
           ▼ (sur kill)
┌─────────────────────┐
│  Killing            │  (Destruction de la sandbox)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Killed             │  (Sandbox détruite)
└─────────────────────┘
```

### Gestion du Lifecycle

```typescript
// Création
const sandbox = await Sandbox.betaCreate(templateId, {
  apiKey,
  envs,
  autoPause: true,
  timeoutMs: 900000
});

// Connexion (auto-resume si paused)
const sandbox = await Sandbox.connect(sandboxId, {
  timeoutMs: 900000
});

// Reset du timeout
await sandbox.setTimeout(900000);

// Pause manuelle
await sandbox.betaPause();

// Résumé manuel
this.sandbox = await this.sandbox.connect({ timeoutMs: 900000 });

// Destruction
await sandbox.kill();
```

---

## 🎛️ SANDBOX STATE MANAGEMENT

### Méthodes de Gestion

**Source**: `lib/e2b/config.ts` (E2BManager)

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

// Méthodes dans E2BManager
async isRunning(): Promise<boolean> {
  if (!this.sandbox) {
    return false;
  }
  return isSandboxRunning(this.sandbox);
}

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

---

## 🚨 ERROR HANDLING

### Types d'Erreurs

| Type | Description | Cause | Solution |
|------|-------------|-------|----------|
| SandboxError | Erreur E2B | Problème avec l'API E2B | Retry ou message utilisateur |
| Timeout | Timeout de la commande | Commande trop longue | Message friendly + suggestion |
| NotFound | Sandbox non trouvée | Sandbox détruite | Créer une nouvelle session |
| Unavailable | Service E2B indisponible | Maintenance E2B | Retry après délai |
| PermissionDenied | Permission refusée | Problème d'authentification | Vérifier l'API key |
| RateLimited | Too many requests | Limite de rate atteinte | Attendre et retry |

### Gestion des Erreurs dans le Code

```typescript
// Dans onFailure de run-agent
onFailure: async ({ error, event }) => {
  const errorMessage = error?.message || String(error);
  
  // Timeout
  const isTimeout = errorMessage.includes('FUNCTION_INVOCATION_TIMEOUT') ||
                    errorMessage.includes('timeout') ||
                    errorMessage.includes('timed out');

  // Sandbox Terminated
  const isSandboxTerminated = errorMessage.includes('terminated') ||
                              errorMessage.includes('[unknown]') ||
                              errorMessage.includes('SandboxError') ||
                              errorMessage.includes('unavailable') ||
                              errorMessage.includes('sandbox not found');

  if (isTimeout) {
    await addMessage(id, `⏱️ **Request Timed Out**\n\nThe AI took too long to respond...`, "assistant");
  } else if (isSandboxTerminated) {
    await addMessage(id, `🔄 **Session Interrupted**\n\nThe development environment was temporarily unavailable...`, "assistant");
  } else {
    // Sanitization et message générique
    let sanitizedError = errorMessage;
    for (const pattern of secretPatterns) {
      sanitizedError = sanitizedError.replace(pattern, '[REDACTED]');
    }
    await addMessage(id, `⚠️ **Agent Error**\n\nSomething went wrong. Please try again.\n\n\`\`\`\n${sanitizedError}\n\`\`\``, "assistant");
  }
}
```

### Sanitization des Secrets

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
  /atk_[a-zA-Z0-9._-]+/gi,            // Other tokens
];
```

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| E2B Integration | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Sandbox Creation | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Sandbox Connection | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Working Directory | ✅ (/vibe0/) | ✅ | ⭐⭐⭐⭐⭐ |
| Session Token | ✅ | ⭐ | ⭐ |
| Environment Files | ✅ | ⭐ | ⭐ |
| Auto-Pause | ✅ | ⭐ | ⭐ |
| Error Handling | ✅ | ✅ | ⭐⭐⭐⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| Working Directory | /vibe0/ | À définir | **Standardiser** |
| Session Token | ✅ | ⭐ | **Ajouter** |
| Startup Script | ✅ | ⭐ | **Ajouter** |
| Env Files | .env.local + .expo_env | À définir | **Standardiser** |
| Auto-Pause | Natif E2B | À adapter | **Adapter** |

### Avantages Vibra à Extraire

1. **Working Directory Standard**: `/vibe0/` comme working directory
2. **Session Token**: Token unique pour chaque session
3. **Environment Files**: Fichiers .env.local et .expo_env
4. **Startup Script**: Script de démarrage pour la configuration initiale
5. **Auto-Pause Natif**: Utilisation de l'auto-pause E2B
6. **Error Recovery**: Gestion robuste des erreurs sandbox

### Points à Améliorer dans SoryOS

1. **Working Directory**: Standardiser sur `/workspace/` ou `/soryos/`
2. **Session Token**: Ajouter un token de session unique
3. **Environment Files**: Standardiser les fichiers d'environnement
4. **Startup Script**: Ajouter un script de démarrage
5. **Auto-Pause**: Configurer l'auto-pause E2B

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. Sandbox Configuration (⭐⭐⭐⭐⭐)

**À Standardiser**:
```rust
// packages/execution/src/sandbox.rs

pub struct SandboxConfig {
    pub working_dir: String,      // Default: "/workspace/"
    pub session_token_path: String, // Default: "/workspace/.soryos_session_token"
    pub env_file_path: String,     // Default: "/workspace/.soryos_env"
    pub auto_pause_timeout_ms: u64, // Default: 900000 (15 min)
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            working_dir: "/workspace/".to_string(),
            session_token_path: "/workspace/.soryos_session_token".to_string(),
            env_file_path: "/workspace/.soryos_env".to_string(),
            auto_pause_timeout_ms: 900000, // 15 minutes
        }
    }
}
```

#### 2. Sandbox Manager (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/execution/src/sandbox.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct Sandbox {
    pub id: String,
    pub working_dir: String,
    pub session_token: String,
    pub is_running: bool,
    pub template_id: String,
    pub host: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SandboxManager {
    client: Arc<dyn E2BClient>,
    sandboxes: Arc<RwLock<HashMap<String, Sandbox>>>,
    config: SandboxConfig,
}

impl SandboxManager {
    pub fn new(client: Arc<dyn E2BClient>, config: SandboxConfig) -> Self {
        Self {
            client,
            sandboxes: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }
    
    pub async fn create(&self, template_id: &str, env_vars: HashMap<String, String>) -> Result<Sandbox, SandboxError> {
        // 1. Generate session token
        let session_token = uuid::Uuid::new_v4().to_string();
        
        // 2. Create E2B sandbox
        let sandbox = self.client.create_sandbox(&CreateSandboxRequest {
            template_id: template_id.to_string(),
            env_vars: env_vars.clone(),
            auto_pause: true,
            timeout_ms: self.config.auto_pause_timeout_ms,
        }).await?;
        
        // 3. Wait for startup script or write files manually
        let needs_env_write = !self.check_env_files(&sandbox.id).await?;
        
        if needs_env_write {
            self.write_env_files(&sandbox.id, &session_token, &env_vars).await?;
        }
        
        // 4. Create sandbox state
        let sandbox_state = Sandbox {
            id: sandbox.id.clone(),
            working_dir: self.config.working_dir.clone(),
            session_token: session_token.clone(),
            is_running: true,
            template_id: template_id.to_string(),
            host: None,
        };
        
        // 5. Store sandbox
        self.sandboxes.write().await.insert(sandbox.id.clone(), sandbox_state.clone());
        
        Ok(sandbox_state)
    }
    
    pub async fn connect(&self, sandbox_id: &str) -> Result<Sandbox, SandboxError> {
        // Check if already connected
        if let Some(sandbox) = self.sandboxes.read().await.get(sandbox_id) {
            if sandbox.is_running {
                return Ok(sandbox.clone());
            }
        }
        
        // Connect to E2B sandbox
        let sandbox = self.client.connect_to_sandbox(sandbox_id).await?;
        
        // Reset timeout
        self.client.set_timeout(sandbox_id, self.config.auto_pause_timeout_ms).await?;
        
        // Update sandbox state
        let mut sandbox_state = self.sandboxes.read().await.get(sandbox_id).cloned().unwrap_or(Sandbox {
            id: sandbox.id.clone(),
            working_dir: self.config.working_dir.clone(),
            session_token: String::new(), // À charger
            is_running: true,
            template_id: String::new(),
            host: None,
        });
        
        sandbox_state.is_running = true;
        self.sandboxes.write().await.insert(sandbox_id.to_string(), sandbox_state.clone());
        
        Ok(sandbox_state)
    }
    
    pub async fn check_env_files(&self, sandbox_id: &str) -> Result<bool, SandboxError> {
        // Vérifier si les fichiers .env existent et contiennent les bonnes valeurs
        let result = self.client.execute_command(&ExecuteCommandRequest {
            sandbox_id: sandbox_id.to_string(),
            command: format!("cat {} 2>/dev/null", self.config.env_file_path),
            ..Default::default()
        }).await?;
        
        Ok(result.stdout.contains(sandbox_id) && result.stdout.contains("SESSION_TOKEN"))
    }
    
    pub async fn write_env_files(&self, sandbox_id: &str, session_token: &str, env_vars: &HashMap<String, String>) -> Result<(), SandboxError> {
        // Écrire .soryos_env
        let mut env_content = format!("SORYOS_SESSION_TOKEN={}\nSORYOS_SANDBOX_ID={}", session_token, sandbox_id);
        
        for (key, value) in env_vars {
            env_content.push_str(&format!("\n{}={}", key, value));
        }
        
        self.client.write_file(&WriteFileRequest {
            sandbox_id: sandbox_id.to_string(),
            path: self.config.env_file_path.clone(),
            content: env_content,
        }).await?;
        
        // Écrire .session_token
        self.client.write_file(&WriteFileRequest {
            sandbox_id: sandbox_id.to_string(),
            path: self.config.session_token_path.clone(),
            content: session_token.to_string(),
        }).await?;
        
        Ok(())
    }
    
    pub async fn get_session_token(&self, sandbox_id: &str) -> Result<String, SandboxError> {
        // Essayer de lire depuis le fichier
        let result = self.client.read_file(&ReadFileRequest {
            sandbox_id: sandbox_id.to_string(),
            path: self.config.session_token_path.clone(),
        }).await?;
        
        if !result.content.is_empty() {
            return Ok(result.content.trim().to_string());
        }
        
        // Sinon, générer un nouveau token
        let token = uuid::Uuid::new_v4().to_string();
        self.write_session_token(sandbox_id, &token).await?;
        
        Ok(token)
    }
    
    pub async fn write_session_token(&self, sandbox_id: &str, token: &str) -> Result<(), SandboxError> {
        self.client.write_file(&WriteFileRequest {
            sandbox_id: sandbox_id.to_string(),
            path: self.config.session_token_path.clone(),
            content: token.to_string(),
        }).await
    }
    
    pub async fn get_host(&self, sandbox_id: &str, port: u16) -> Result<String, SandboxError> {
        let host = self.client.get_host(sandbox_id, port).await?;
        Ok(format!("https://{}", host))
    }
    
    pub async fn is_running(&self, sandbox_id: &str) -> Result<bool, SandboxError> {
        self.client.is_running(sandbox_id).await
    }
    
    pub async fn kill(&self, sandbox_id: &str) -> Result<(), SandboxError> {
        self.client.kill_sandbox(sandbox_id).await?;
        self.sandboxes.write().await.remove(sandbox_id);
        Ok(())
    }
    
    pub async fn pause(&self, sandbox_id: &str) -> Result<(), SandboxError> {
        self.client.pause_sandbox(sandbox_id).await
    }
    
    pub async fn resume(&self, sandbox_id: &str) -> Result<(), SandboxError> {
        self.client.resume_sandbox(sandbox_id).await?;
        self.client.set_timeout(sandbox_id, self.config.auto_pause_timeout_ms).await?;
        Ok(())
    }
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: Sandbox System Foundation (Priorité ⭐⭐⭐⭐⭐)

1. **Standardiser la Configuration**
   - Créer `packages/execution/src/sandbox.rs`
   - Définir SandboxConfig avec working_dir, session_token_path, etc.
   - Tester la configuration

2. **Créer le SandboxManager**
   - Implémenter create, connect, kill, pause, resume
   - Tester avec des sandboxes réelles

3. **Intégrer avec E2B**
   - Adapter pour utiliser l'API E2B
   - Tester la création et connexion

### Phase 2: Sandbox Features (Priorité ⭐⭐⭐⭐)

4. **Ajouter le Session Token**
   - Implémenter get_session_token et write_session_token
   - Tester la génération et lecture

5. **Ajouter les Environment Files**
   - Implémenter write_env_files
   - Tester l'écriture et lecture des fichiers .env

6. **Ajouter le Startup Script**
   - Créer un startup script pour les templates
   - Tester l'exécution automatique

### Phase 3: Integration (Priorité ⭐⭐⭐⭐)

7. **Intégrer avec ExecutionProvider**
   - Adapter ExecutionProvider pour utiliser SandboxManager
   - Tester l'exécution de commandes

8. **Intégrer avec SessionManager**
   - Lier SandboxManager à SessionManager
   - Tester la création de session avec sandbox

---

## 📚 RÉFÉRENCES

- [E2B SDK Documentation](https://e2b.dev/docs/sdk)
- [E2B Sandbox API](https://e2b.dev/docs/api/sandboxes)
- [Vibra Code E2B Config](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/e2b/config.ts)
- [Vibra Code Templates](https://github.com/sa4hnd/vibra-code/tree/main/e2b-cursor-template)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
