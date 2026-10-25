# Vibra Code - Background Jobs System Analysis

> **Projet**: Extraction du Background Jobs System de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [Inngest Architecture](#-inngest-architecture)
3. [Inngest Configuration](#-inngest-configuration)
4. [Function System](#-function-system)
5. [Event Flow](#-event-flow)
6. [Retry Mechanism](#-retry-mechanism)
7. [Concurrency Control](#-concurrency-control)
8. [Failure Handling](#-failure-handling)
9. [Step System](#-step-system)
10. [Long Running Tasks](#-long-running-tasks)
11. [Comparison avec SoryOS](#-comparison-avec-soryos)
12. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture du Background Jobs System

```
┌─────────────────────────────────────────────────────────────────────┐
│                   VIBRA CODE BACKGROUND JOBS SYSTEM                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   USER      │    │   API       │    │   INNGEST   │              │
│  │  Request    │───►│  Route      │───►│  EVENT      │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    INNGEST QUEUE                               │   │
│  │  - Event-driven architecture                                    │   │
│  │  - Queue de messages                                            │   │
│  │  - Processing par workers                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    INNGEST FUNCTIONS                             │   │
│  │  - run-agent: Exécute l'agent dans la sandbox                    │   │
│  │  - create-session: Crée une nouvelle session                    │   │
│  │  - push-to-github: Push le code vers GitHub                     │   │
│  │  - generate-image: Génère une image                            │   │
│  │  - generate-video: Génère une vidéo                            │   │
│  │  - steal-app: Copie une application existante                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    STEP SYSTEM                                  │   │
│  │  - step.run("name", async () => {...})                          │   │
│  │  - Exécution séquentielle ou parallèle                           │   │
│  │  - Gestion des erreurs par step                                 │   │
│  │  - Logging et monitoring                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    RESULT HANDLING                              │   │
│  │  - Update Convex DB                                             │   │
│  │  - Stream to client                                             │   │
│  │  - Trigger next events                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `lib/inngest.ts` | Configuration Inngest | ⭐⭐⭐⭐ | 100+ |
| `lib/inngest/client.ts` | Client Inngest | ⭐⭐⭐ | 50 |
| `lib/inngest/middleware.ts` | Middleware Inngest | ⭐⭐⭐⭐ | 150+ |
| `lib/inngest/functions/run-agent.ts` | Fonction run-agent | ⭐⭐⭐⭐⭐ | 1200+ |
| `lib/inngest/functions/create-session.ts` | Fonction create-session | ⭐⭐⭐⭐⭐ | 150+ |
| `lib/inngest/functions/push-to-github.ts` | Fonction push-to-github | ⭐⭐⭐⭐ | 100+ |
| `lib/inngest/functions/generate-image.ts` | Fonction generate-image | ⭐⭐⭐⭐ | 200+ |
| `lib/inngest/functions/generate-video.ts` | Fonction generate-video | ⭐⭐⭐⭐ | 200+ |
| `lib/inngest/functions/steal-app.ts` | Fonction steal-app | ⭐⭐⭐⭐ | 400+ |

---

## 🏗️ INNGEST ARCHITECTURE

### Concepts de Base

**Inngest** est une plateforme **Serverless Workflow Engine** qui permet:

1. **Event-Driven**: Déclenchement de fonctions par des événements
2. **Queue**: Mise en file d'attente des tâches
3. **Retry**: Retry automatique en cas d'échec
4. **Concurrency**: Contrôle du nombre d'exécutions simultanées
5. **Step-Based**: Découpage des fonctions en étapes
6. **Long Running**: Support des tâches longues
7. **Failure Handling**: Gestion des erreurs avec handlers

### Intégration dans Vibra

Vibra utilise Inngest pour:
- ✅ Exécuter l'agent dans une sandbox E2B
- ✅ Créer des sessions
- ✅ Pusher le code vers GitHub
- ✅ Générer des images/vidéos
- ✅ Copier des applications
- ✅ Gérer les tâches asynchrones

### Avantages d'Inngest

| Avantages | Description |
|-----------|-------------|
| Event-Driven | Architecture basée sur les événements |
| Scalable | Scale automatiquement avec la charge |
| Reliable | Retry automatique et persistance |
| Simple | API simple et intuitive |
| Monitoring | Dashboard de monitoring intégré |
| Local Dev | Développement local avec Inngest CLI |

---

## ⚙️ INNGEST CONFIGURATION

### Configuration de Base

**Source**: `lib/inngest.ts`

```typescript
// Re-export de la structure organisée
import { inngest } from "./inngest/client";
import { updateSessionStatus, addMessage, getSessionData, getSessionMessages } from "./inngest/middleware";
import { runAgent } from "./inngest/functions/run-agent";
import { createSession } from "./inngest/functions/create-session";
import { pushToGitHub } from "./inngest/functions/push-to-github";
import { generateVideo } from "./inngest/functions/generate-video";
import { generateImage } from "./inngest/functions/generate-image";
import { stealApp } from "./inngest/functions/steal-app";

export { inngest, sessionChannel, getInngestApp } from "./inngest/client";
export { updateSessionStatus, addMessage, getSessionData, getSessionMessages } from "./inngest/middleware";
export { runAgent, createSession, pushToGitHub, generateVideo, generateImage, stealApp };
```

### Client Inngest

**Source**: `lib/inngest/client.ts`

```typescript
import { Inngest } from 'inngest';

// Création du client Inngest
export const inngest = new Inngest({
  id: 'vibracode',
  // Autres options...
});

// Canal pour les sessions
export const sessionChannel = inngest.createChannel('sessions', {
  // Configuration du canal...
});

// Fonction pour obtenir l'app Inngest
export const getInngestApp = () => inngest;
```

### Middleware Inngest

**Source**: `lib/inngest/middleware.ts`

```typescript
import { inngest } from './client';
import { Id } from '@/convex/_generated/dataModel';

// Middleware pour mettre à jour le statut de la session
export const updateSessionStatus = async (
  sessionId: Id<"sessions">,
  status: SessionStatus,
  statusMessage?: string,
  tunnelUrl?: string,
  sandboxId?: string
) => {
  try {
    const { fetchMutation } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");

    await fetchMutation(api.sessions.update, {
      id: sessionId,
      status,
      statusMessage,
      tunnelUrl,
      sessionId: sandboxId,
    });
  } catch (error) {
    console.warn('⚠️ Non-fatal: Failed to update session status:', error);
  }
};

// Middleware pour ajouter un message
export const addMessage = async (
  sessionId: Id<"sessions">,
  content: string,
  role: "user" | "assistant",
  timestamp?: number,
  metadata?: any
) => {
  try {
    const { fetchMutation } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");

    const messageId = await fetchMutation(api.messages.add, {
      sessionId,
      content,
      role,
      metadata,
    });

    return messageId;
  } catch (error) {
    console.warn('⚠️ Non-fatal: Failed to add message:', error);
    return null;
  }
};

// Middleware pour récupérer les données de session
export const getSessionData = async (sessionId: Id<"sessions">) => {
  try {
    const { fetchQuery } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");

    return await fetchQuery(api.sessions.getByIdInternal, { id: sessionId });
  } catch (error) {
    console.warn('⚠️ Non-fatal: Failed to get session data:', error);
    return null;
  }
};

// Middleware pour récupérer les messages de session
export const getSessionMessages = async (sessionId: Id<"sessions">) => {
  try {
    const { fetchQuery } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");

    return await fetchQuery(api.messages.listBySessionInternal, { sessionId });
  } catch (error) {
    console.warn('⚠️ Non-fatal: Failed to get session messages:', error);
    return [];
  }
};
```

---

## 📁 FUNCTION SYSTEM

### Structure des Fonctions

Les fonctions Inngest dans Vibra suivent cette structure:

```typescript
inngest.createFunction(
  {
    id: string,           // ID unique de la fonction
    retries: number,      // Nombre de retries (default: 3)
    concurrency: number,  // Nombre max d'exécutions simultanées
    timeout: number,      // Timeout en secondes (default: 60)
    onFailure: async ({ error, event, step }) => { ... } // Handler d'échec
  },
  { event: string },      // Événement qui déclenche la fonction
  async ({ event, step }) => {
    // Logique de la fonction
    // Utilisation de step.run() pour les sous-tâches
    const result = await step.run("nom de la step", async () => {
      // Code à exécuter
    });
    
    return result;
  }
);
```

### Fonctions Principales

| Fonction | Événement | Description | Retries | Concurrency |
|----------|-----------|-------------|---------|-------------|
| runAgent | vibracode/run.agent | Exécute l'agent dans la sandbox | 0 | 25 |
| createSession | vibracode/create.session | Crée une nouvelle session | 0 | 25 |
| pushToGitHub | vibracode/push.to.github | Push le code vers GitHub | 2 | N/A |
| generateImage | vibracode/generate.image | Génère une image | 2 | N/A |
| generateVideo | vibracode/generate.video | Génère une vidéo | 2 | N/A |
| stealApp | vibracode/steal.app | Copie une application | 2 | N/A |

### Exemple: createSession

**Source**: `lib/inngest/functions/create-session.ts`

```typescript
export const createSession = inngest.createFunction(
  { id: "create-session", retries: 0, concurrency: 25 },
  { event: "vibracode/create.session" },
  async ({ event, step }) => {
    const {
      sessionId: id,
      message,
      repository,
      token,
      template,
    }: {
      sessionId: Id<"sessions">;
      message: string;
      repository: string;
      token: string;
      template: Template;
    } = event.data;

    // Step 1: Create sandbox and trigger agent
    const sandboxData = await step.run("create sandbox", async () => {
      const title = await generateSessionTitle(message);

      const { fetchMutation } = await import("convex/nextjs");
      const { api } = await import("@/convex/_generated/api");

      await fetchMutation(api.sessions.update, {
        id,
        status: "CLONING_REPO",
        name: title,
      });

      const sandbox = await e2bManager.createSandbox();

      return {
        sandboxId: sandbox.sandboxId,
        title,
      };
    });

    // Step 2: Trigger agent early
    if (message) {
      await step.run("run agent early", async () => {
        await inngest.send({
          name: "vibracode/run.agent",
          data: {
            sessionId: sandboxData.sandboxId,
            id,
            message,
            template,
            repository: repository || null,
            token,
          },
        });
      });
    }

    // Step 3: Start dev server
    const data = await step.run("start dev server", async () => {
      await e2bManager.connectToSandbox(sandboxData.sandboxId);
      
      if (!repository && template) {
        await updateSessionStatus(id, "STARTING_DEV_SERVER");
        
        for await (const command of template.startCommands) {
          await updateSessionStatus(id, command.status, undefined, sandboxData.sandboxId);
          await e2bManager.executeCommand(command.command, {
            background: command.background,
          });
        }

        const host = await e2bManager.getHost(3000);

        return {
          sandboxId: sandboxData.sandboxId,
          tunnelUrl: host,
          repository: null,
        };
      } else {
        // Clone repo if provided
        if (repository) {
          await e2bManager.executeCommand(
            `git clone https://${token}@github.com/${repository}.git .`
          );
        }

        await updateSessionStatus(id, "STARTING_DEV_SERVER");

        await e2bManager.executeCommand("npx expo start --tunnel --port 3000", {
          background: true,
        });

        await updateSessionStatus(id, "CREATING_TUNNEL");

        const host = await e2bManager.getHost(3000);

        return {
          sandboxId: sandboxData.sandboxId,
          tunnelUrl: host,
          repository: repository,
        };
      }
    });

    // Step 4: Update session
    await step.run("update session", async () => {
      await updateSessionStatus(id, "RUNNING", undefined, data.tunnelUrl, data.sandboxId);
    });

    return data;
  }
);
```

### Exemple: runAgent

**Source**: `lib/inngest/functions/run-agent.ts` (extrait)

```typescript
export const runAgent = inngest.createFunction(
  {
    id: "run-agent",
    retries: 0,           // Pas de retry automatique
    concurrency: 25,      // Max 25 exécutions simultanées
    onFailure: async ({ error, event }) => {
      // Handler de failure
    },
  },
  { event: "vibracode/run.agent" },
  async ({ event, step }) => {
    const { sessionId, id, message, template, model } = event.data;

    try {
      const result = await step.run("generate code", async () => {
        // Logique principale
      });
      
      return { success: true, sessionId, messageId: id };
    } catch (error) {
      console.error("Error in run-agent:", error);
      throw error;
    }
  }
);
```

---

## 🔄 EVENT FLOW

### Flow Complet

```
USER ACTION
  │
  ▼
┌─────────────────────┐
│  API Request         │  (POST /api/create-session)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Send Inngest        │  (inngest.send())
│  Event              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Inngest Queue       │  (Mise en file d'attente)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Inngest Worker      │  (Traitement de l'événement)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Function Execution   │  (Exécution de createSession)
│  (Step 1)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Create Sandbox      │  (Création de la sandbox E2B)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Step 2: Trigger     │  (Envoi d'un nouvel événement Inngest)
│  Agent              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Inngest Queue       │  (Nouvel événement en file)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Function Execution   │  (Exécution de runAgent)
│  (Step 2)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Execute Agent in    │  (Exécution dans la sandbox)
│  Sandbox            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Stream Results      │  (Streaming des résultats)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Update Convex DB    │  (Mise à jour de la session)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Realtime Update     │  (Mise à jour du client)
└─────────────────────┘
```

### Déclenchement d'Événements

```typescript
// Depuis une API Route
const { inngest } = await import('@/lib/inngest');

await inngest.send({
  name: "vibracode/run.agent",
  data: {
    sessionId,
    id,
    message,
    template,
    repository,
  },
});

// Depuis une Server Action
const { inngest } = await import('@/lib/inngest');

await inngest.send({
  name: "vibracode/create.session",
  data: {
    sessionId,
    message,
    template,
    token,
  },
});

// Depuis une Inngest Function
await inngest.send({
  name: "vibracode/push.to.github",
  data: {
    id,
    token,
    repository,
  },
});
```

---

## 🔄 RETRY MECHANISM

### Configuration des Retries

```typescript
// Pas de retry pour les fonctions critiques
{ id: "run-agent", retries: 0, ... }

// 2 retries pour les fonctions moins critiques
{ id: "push-to-github", retries: 2, ... }

// Retry par défaut: 3
```

### Comportement des Retries

1. **Première tentative**: Exécution normale
2. **Échec**: Attente de quelques secondes
3. **Deuxième tentative**: Réessayer avec les mêmes données
4. **Échec**: Attente plus longue
5. **Troisième tentative**: Dernier essai
6. **Échec final**: Appel du handler `onFailure`

### Exemple avec Retries

**Source**: `lib/inngest/functions/push-to-github.ts`

```typescript
export const pushToGitHub = inngest.createFunction(
  { id: "push-to-github", retries: 2 },  // 2 retries
  { event: "vibracode/push.to.github" },
  async ({ event, step }) => {
    const { id, token, repository } = event.data;

    const e2bManager = new E2BManager();
    await e2bManager.connectToSandbox(id);

    // Update status
    await step.run("update status", async () => {
      await updateSessionStatus(id, "PUSHING_TO_GITHUB");
    });

    // Commit and push (peut échouer et être retry)
    const result = await step.run("commit and push", async () => {
      return await e2bManager.commitAndPush(
        token,
        repository,
        `Vibra Code: ${new Date().toISOString()}`,
        false
      );
    });

    // Update session
    await step.run("update session", async () => {
      const status = result.success ? "PUSH_COMPLETE" : "PUSH_FAILED";
      await updateSessionStatus(id, status);
      
      await fetchMutation(api.sessions.update, {
        id,
        githubPushStatus: result.success ? 'completed' : 'failed',
        githubPushDate: Date.now(),
      });
    });

    return result;
  }
);
```

---

## ⚙️ CONCURRENCY CONTROL

### Limite de Concurrency

```typescript
// 25 exécutions simultanées max pour les fonctions principales
{ id: "run-agent", concurrency: 25, ... }
{ id: "create-session", concurrency: 25, ... }

// Pas de limite pour les autres fonctions (default: illimité)
{ id: "push-to-github", ... }
```

### Comportement

1. **Si limite atteinte**: Les nouveaux événements sont mis en file d'attente
2. **Dès qu'un slot est libre**: Le prochain événement est traité
3. **Ordre**: FIFO (First In, First Out)

### Gestion des Priorités

Inngest ne supporte pas nativement les priorités, mais Vibra utilise:
- **Concurrency élevée** pour les fonctions critiques (run-agent, create-session)
- **Concurrency illimitée** pour les fonctions moins critiques
- **Ordre d'envoi** pour gérer les priorités implicites

---

## 🚨 FAILURE HANDLING

### Handler onFailure

Chaque fonction Inngest peut avoir un handler `onFailure`:

```typescript
inngest.createFunction(
  {
    id: "run-agent",
    retries: 0,
    concurrency: 25,
    onFailure: async ({ error, event, step }) => {
      // Ce code est exécuté après que la fonction a échoué
      // ou que tous les retries ont été épuisés
      
      const { id } = event.data as { id: Id<"sessions"> };
      
      try {
        const errorMessage = error?.message || String(error);
        
        // Détection du type d'erreur
        const isTimeout = errorMessage.includes('FUNCTION_INVOCATION_TIMEOUT') ||
                          errorMessage.includes('timeout');
        const isSandboxTerminated = errorMessage.includes('terminated') ||
                                    errorMessage.includes('SandboxError');
        
        // Reset du statut
        await updateSessionStatus(id, "RUNNING");
        
        if (isTimeout) {
          // Message friendly pour timeout
          await addMessage(id, `⏱️ **Request Timed Out**\n\n...`, "assistant");
        } else if (isSandboxTerminated) {
          // Message pour sandbox terminée
          await addMessage(id, `🔄 **Session Interrupted**\n\n...`, "assistant");
        } else {
          // Sanitization et message générique
          let sanitizedError = errorMessage;
          for (const pattern of secretPatterns) {
            sanitizedError = sanitizedError.replace(pattern, '[REDACTED]');
          }
          await addMessage(id, `⚠️ **Agent Error**\n\n...\n\`\`\`\n${sanitizedError}\n\`\`\``, "assistant");
        }
      } catch (failureError) {
        console.error('❌ Failed to handle failure:', failureError);
      }
    },
  },
  { event: "vibracode/run.agent" },
  async ({ event, step }) => { ... }
);
```

### Types d'Erreurs Gérés

| Type | Détection | Message Utilisateur |
|------|-----------|---------------------|
| Timeout | `FUNCTION_INVOCATION_TIMEOUT`, `timeout`, `timed out` | Message de timeout friendly |
| Sandbox Terminated | `terminated`, `[unknown]`, `SandboxError`, `unavailable` | Message de reprise |
| Erreur Générale | Tout autre erreur | Message générique avec sanitization |

### Sanitization des Erreurs

```typescript
const secretPatterns = [
  /sk-ant-[a-zA-Z0-9-]+/g,        // Anthropic API keys
  /sk-[a-zA-Z0-9-]{20,}/g,        // Stripe API keys
  /ghp_[a-zA-Z0-9]+/g,            // GitHub tokens
  /gho_[a-zA-Z0-9]+/g,            // GitHub OAuth tokens
  /xai-[a-zA-Z0-9-]+/g,           // XAI API keys
  /Bearer\s+[a-zA-Z0-9._-]+/gi,    // Bearer tokens
  /Authorization:\s*[^\s,}]+/gi, // Authorization headers
  /api[_-]?key["\s:=]+[a-zA-Z0-9._-]+/gi,
  /token["\s:=]+[a-zA-Z0-9._-]+/gi,
  /secret["\s:=]+[a-zA-Z0-9._-]+/gi,
  /password["\s:=]+[^\s,}]+/gi,
];

let sanitizedError = errorMessage;
for (const pattern of secretPatterns) {
  sanitizedError = sanitizedError.replace(pattern, '[REDACTED]');
}
```

---

## 📋 STEP SYSTEM

### Concept des Steps

Les fonctions Inngest peuvent être découpées en **steps**:

```typescript
inngest.createFunction(
  { id: "create-session", retries: 0, concurrency: 25 },
  { event: "vibracode/create.session" },
  async ({ event, step }) => {
    // Step 1
    const sandboxData = await step.run("create sandbox", async () => {
      // Code pour créer la sandbox
    });

    // Step 2 (exécutée en parallèle de Step 1 si possible)
    if (message) {
      await step.run("run agent early", async () => {
        // Code pour déclencher l'agent
      });
    }

    // Step 3
    const data = await step.run("start dev server", async () => {
      // Code pour démarrer le serveur
    });

    // Step 4
    await step.run("update session", async () => {
      // Code pour mettre à jour la session
    });

    return data;
  }
);
```

### Avantages des Steps

1. **Logging**: Chaque step est logguée séparément
2. **Error Handling**: Gestion des erreurs par step
3. **Monitoring**: Dashboard Inngest montre chaque step
4. **Debugging**: Plus facile de debugger
5. **Metrics**: Métriques par step

### Exécution Parallèle

```typescript
// Exécution séquentielle (par défaut)
await step.run("step 1", async () => { ... });
await step.run("step 2", async () => { ... });

// Exécution parallèle (avec Promise.all)
const [result1, result2] = await Promise.all([
  step.run("step 1", async () => { ... }),
  step.run("step 2", async () => { ... }),
]);
```

---

## ⏳ LONG RUNNING TASKS

### Configuration

Pour les tâches longues, Vibra utilise:

1. **`background: true`** pour les commandes E2B
2. **`timeoutMs: 0`** pour désactiver le timeout
3. **`requestTimeoutMs: 900000`** (15 min) pour le timeout HTTP
4. **Auto-pause** des sandboxes après 15 min d'inactivité

### Exemple de Tâche Longue

**Source**: `lib/inngest/functions/run-agent.ts`

```typescript
// Exécution de l'agent (peut prendre plusieurs minutes)
const result = await step.run("generate code", async () => {
  // Connexion à la sandbox
  await e2bManager.connectToSandbox(sessionId);
  
  // Exécution de l'agent (streaming)
  await executeClaudeAgent(e2bManager.getSandbox()!, message, {
    onStdout: handleStdout,
    onStderr: handleStderr,
    isFirstMessage: isFirstMessage,
    model: model,
  });
  
  return { success: true };
});
```

### Gestion du Timeout

```typescript
// Dans executeCommand
const result = await sandbox.commands.run(finalCommand, {
  onStdout: options.onStdout,
  onStderr: options.onStderr,
  background: options.background || false,
  timeoutMs: 0, // Désactive le timeout pour les commandes longues
  requestTimeoutMs: 900000, // 15 minutes pour le timeout HTTP
  envs: options.envVars
});
```

### Reprise après Timeout

```typescript
// Dans le handler onFailure
if (isTimeout) {
  const timeoutMessage = `⏱️ **Request Timed Out**\n\nThe AI took too long to respond. This can happen with complex tasks.\n\n**To continue:**\n• Send a new message to resume where we left off\n• Try breaking your request into smaller steps\n• Type "continue" to pick up from here\n\nYour progress has been saved.`;
  await addMessage(id, timeoutMessage, "assistant");
}
```

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| Background Jobs | ✅ (Inngest) | ⭐ | ⭐ |
| Event-Driven | ✅ | ⭐ | ⭐ |
| Queue System | ✅ | ⭐ | ⭐ |
| Retry Mechanism | ✅ | ⭐ | ⭐ |
| Concurrency Control | ✅ | ⭐ | ⭐ |
| Failure Handling | ✅ | ⭐ | ⭐ |
| Step System | ✅ | ⭐ | ⭐ |
| Long Running Tasks | ✅ | ⭐ | ⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| Job System | Inngest | À implémenter | **Adapter** |
| Event Flow | Inngest Events | À définir | **Adapter** |
| Retry Mechanism | Configurable | À implémenter | **Implémenter** |
| Concurrency | Configurable | À implémenter | **Implémenter** |
| Step System | Inngest Steps | À implémenter | **Implémenter** |

### Avantages Vibra à Extraire

1. **Event-Driven Architecture**: Architecture basée sur les événements
2. **Inngest Integration**: Intégration complète avec Inngest
3. **Retry Mechanism**: Retry configurable par fonction
4. **Concurrency Control**: Limite de concurrency configurable
5. **Failure Handling**: Handlers onFailure pour chaque fonction
6. **Step System**: Découpage en steps pour le logging et debugging
7. **Long Running Tasks**: Support des tâches longues avec timeout

### Points à Améliorer dans SoryOS

1. **Job System**: Doit supporter les jobs en arrière-plan
2. **Event-Driven**: Doit être basé sur les événements
3. **Retry Mechanism**: Doit être configurable
4. **Concurrency Control**: Doit limiter la concurrency
5. **Failure Handling**: Doit avoir des handlers d'échec

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. Job Manager (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/jobs/src/manager.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct Job {
    pub id: String,
    pub name: String,
    pub status: JobStatus,
    pub data: serde_json::Value,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub retries: u32,
    pub max_retries: u32,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, strum::Display)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Retrying,
    Cancelled,
}

#[async_trait]
pub trait JobManager: Send + Sync {
    async fn queue(&self, name: &str, data: serde_json::Value, options: QueueOptions) -> Result<String, JobError>;
    async fn get(&self, job_id: &str) -> Result<Option<Job>, JobError>;
    async fn list(&self, status: Option<JobStatus>) -> Result<Vec<Job>, JobError>;
    async fn cancel(&self, job_id: &str) -> Result<(), JobError>;
    async fn start_worker(&self) -> Result<(), JobError>;
    async fn stop_worker(&self) -> Result<(), JobError>;
}

#[derive(Debug, Clone)]
pub struct QueueOptions {
    pub priority: u32,
    pub max_retries: u32,
    pub timeout_seconds: u64,
    pub concurrency_key: Option<String>,
}

impl Default for QueueOptions {
    fn default() -> Self {
        Self {
            priority: 0,
            max_retries: 3,
            timeout_seconds: 3600, // 1 heure
            concurrency_key: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct JobManagerImpl {
    jobs: Arc<RwLock<HashMap<String, Job>>>,
    queue: Arc<RwLock<Vec<String>>>,
    workers: Arc<RwLock<Vec<tokio::task::JoinHandle<()>>>>,
    running: Arc<RwLock<HashMap<String, bool>>>,
    concurrency_limit: usize,
    job_handlers: HashMap<String, Arc<dyn JobHandler + Send + Sync>>,
}

#[async_trait]
pub trait JobHandler: Send + Sync {
    async fn handle(&self, job: &Job) -> Result<serde_json::Value, JobError>;
}

#[async_trait]
impl JobManager for JobManagerImpl {
    async fn queue(&self, name: &str, data: serde_json::Value, options: QueueOptions) -> Result<String, JobError> {
        let job_id = uuid::Uuid::new_v4().to_string();
        
        let job = Job {
            id: job_id.clone(),
            name: name.to_string(),
            status: JobStatus::Pending,
            data,
            result: None,
            error: None,
            retries: 0,
            max_retries: options.max_retries,
            created_at: chrono::Utc::now().timestamp(),
            started_at: None,
            completed_at: None,
        };
        
        // Ajouter à la queue
        self.jobs.write().await.insert(job_id.clone(), job);
        self.queue.write().await.push(job_id.clone());
        
        // Trier la queue par priorité
        self.sort_queue().await;
        
        Ok(job_id)
    }
    
    async fn get(&self, job_id: &str) -> Result<Option<Job>, JobError> {
        let jobs = self.jobs.read().await;
        Ok(jobs.get(job_id).cloned())
    }
    
    async fn list(&self, status: Option<JobStatus>) -> Result<Vec<Job>, JobError> {
        let jobs = self.jobs.read().await;
        let mut result: Vec<Job> = jobs.values().cloned().collect();
        
        if let Some(status) = status {
            result.retain(|j| j.status == status);
        }
        
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(result)
    }
    
    async fn cancel(&self, job_id: &str) -> Result<(), JobError> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = JobStatus::Cancelled;
            job.completed_at = Some(chrono::Utc::now().timestamp());
        }
        Ok(())
    }
    
    async fn start_worker(&self) -> Result<(), JobError> {
        let worker = tokio::spawn(self.worker_loop());
        self.workers.write().await.push(worker);
        Ok(())
    }
    
    async fn stop_worker(&self) -> Result<(), JobError> {
        // Arrêter tous les workers
        for worker in self.workers.write().await.drain(..) {
            worker.abort();
        }
        Ok(())
    }
    
    async fn worker_loop(&self) {
        loop {
            // Vérifier la limite de concurrency
            let running_count = self.running.read().await.len();
            if running_count >= self.concurrency_limit {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                continue;
            }
            
            // Récupérer le prochain job
            let job_id = {
                let mut queue = self.queue.write().await;
                queue.pop()
            };
            
            if job_id.is_none() {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                continue;
            }
            
            let job_id = job_id.unwrap();
            
            // Marquer comme running
            self.running.write().await.insert(job_id.clone(), true);
            
            // Mettre à jour le statut
            self.update_job_status(&job_id, JobStatus::Running).await;
            
            // Récupérer le job
            let job = self.get(&job_id).await.unwrap().unwrap();
            
            // Exécuter le job
            let result = self.execute_job(&job).await;
            
            // Marquer comme complété
            self.running.write().await.remove(&job_id);
            
            match result {
                Ok(result) => {
                    self.update_job_result(&job_id, Some(result), None).await;
                    self.update_job_status(&job_id, JobStatus::Completed).await;
                }
                Err(error) => {
                    let job = self.get(&job_id).await.unwrap().unwrap();
                    if job.retries < job.max_retries {
                        // Retry
                        self.update_job_retries(&job_id).await;
                        self.update_job_status(&job_id, JobStatus::Retrying).await;
                        
                        // Remettre dans la queue
                        self.queue.write().await.push(job_id);
                        self.sort_queue().await;
                    } else {
                        // Échec final
                        self.update_job_result(&job_id, None, Some(error.to_string())).await;
                        self.update_job_status(&job_id, JobStatus::Failed).await;
                    }
                }
            }
        }
    }
    
    async fn execute_job(&self, job: &Job) -> Result<serde_json::Value, JobError> {
        if let Some(handler) = self.job_handlers.get(&job.name) {
            handler.handle(job).await
        } else {
            Err(JobError::UnknownJob(job.name.clone()))
        }
    }
    
    async fn update_job_status(&self, job_id: &str, status: JobStatus) -> Result<(), JobError> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = status;
            
            match status {
                JobStatus::Running => {
                    job.started_at = Some(chrono::Utc::now().timestamp());
                }
                JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled => {
                    job.completed_at = Some(chrono::Utc::now().timestamp());
                }
                _ => {}
            }
        }
        Ok(())
    }
    
    async fn update_job_result(&self, job_id: &str, result: Option<serde_json::Value>, error: Option<String>) -> Result<(), JobError> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.result = result;
            job.error = error;
        }
        Ok(())
    }
    
    async fn update_job_retries(&self, job_id: &str) -> Result<(), JobError> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.retries += 1;
        }
        Ok(())
    }
    
    async fn sort_queue(&self) {
        let mut queue = self.queue.write().await;
        let jobs = self.jobs.read().await;
        
        queue.sort_by(|a, b| {
            let a_job = jobs.get(a).unwrap();
            let b_job = jobs.get(b).unwrap();
            b_job.priority.cmp(&a_job.priority)
        });
    }
    
    pub fn register_handler(&mut self, name: String, handler: Arc<dyn JobHandler + Send + Sync>) {
        self.job_handlers.insert(name, handler);
    }
}
```

#### 2. Job Handler pour Run Agent (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/jobs/src/handlers/run_agent.rs

use std::sync::Arc;
use async_trait::async_trait;

pub struct RunAgentHandler {
    agent_runtime: Arc<dyn AgentRuntime>,
    session_manager: Arc<dyn SessionManager>,
}

#[async_trait]
impl JobHandler for RunAgentHandler {
    async fn handle(&self, job: &Job) -> Result<serde_json::Value, JobError> {
        // Extraire les données du job
        let session_id = job.data.get("session_id").and_then(|v| v.as_str())
            .ok_or(JobError::InvalidData("session_id is required".to_string()))?;
        let message = job.data.get("message").and_then(|v| v.as_str())
            .ok_or(JobError::InvalidData("message is required".to_string()))?;
        
        // Récupérer la session
        let session = self.session_manager.get(session_id).await
            .map_err(|e| JobError::ExecutionError(e.to_string()))?;
        
        // Exécuter l'agent
        let result = self.agent_runtime.run(session_id, message.to_string()).await
            .map_err(|e| JobError::ExecutionError(e.to_string()))?;
        
        // Retourner le résultat
        Ok(serde_json::json!({
            "success": true,
            "session_id": session_id,
            "result": result,
        }))
    }
}
```

#### 3. Event System (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/jobs/src/events.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};

#[derive(Debug, Clone)]
pub struct Event {
    pub name: String,
    pub data: serde_json::Value,
    pub timestamp: i64,
}

#[derive(Debug, Clone)]
pub struct EventManager {
    job_manager: Arc<dyn JobManager>,
    event_handlers: Arc<RwLock<HashMap<String, Vec<Arc<dyn EventHandler + Send + Sync>>>>>,
}

#[async_trait]
pub trait EventHandler: Send + Sync {
    async fn handle(&self, event: &Event) -> Result<(), JobError>;
}

impl EventManager {
    pub fn new(job_manager: Arc<dyn JobManager>) -> Self {
        Self {
            job_manager,
            event_handlers: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn emit(&self, name: &str, data: serde_json::Value) -> Result<(), JobError> {
        let event = Event {
            name: name.to_string(),
            data,
            timestamp: chrono::Utc::now().timestamp(),
        };
        
        // Appeler les handlers
        let handlers = self.event_handlers.read().await;
        if let Some(handlers) = handlers.get(name) {
            for handler in handlers {
                handler.handle(&event).await?;
            }
        }
        
        // Queue le job correspondant
        self.queue_job_from_event(&event).await?;
        
        Ok(())
    }
    
    pub fn register_handler(&self, event_name: String, handler: Arc<dyn EventHandler + Send + Sync>) {
        let mut handlers = self.event_handlers.blocking_write();
        handlers.entry(event_name).or_default().push(handler);
    }
    
    async fn queue_job_from_event(&self, event: &Event) -> Result<(), JobError> {
        match event.name.as_str() {
            "agent.run" => {
                self.job_manager.queue("run_agent", event.data.clone(), QueueOptions::default()).await?;
            }
            "session.create" => {
                self.job_manager.queue("create_session", event.data.clone(), QueueOptions::default()).await?;
            }
            "github.push" => {
                self.job_manager.queue("push_to_github", event.data.clone(), QueueOptions::default()).await?;
            }
            _ => {}
        }
        Ok(())
    }
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: Job System Foundation (Priorité ⭐⭐⭐⭐⭐)

1. **Créer le Job Manager**
   - Créer `packages/jobs/src/manager.rs`
   - Implémenter queue, get, list, cancel
   - Tester avec des jobs mock

2. **Créer le Job Model**
   - Définir Job, JobStatus, QueueOptions
   - Implémenter la sérialisation/désérialisation

3. **Intégrer avec la base de données**
   - Persister les jobs dans la DB
   - Tester la persistance

### Phase 2: Event System (Priorité ⭐⭐⭐⭐)

4. **Créer l'Event Manager**
   - Créer `packages/jobs/src/events.rs`
   - Implémenter emit et register_handler
   - Tester avec des événements mock

5. **Ajouter les Event Handlers**
   - Créer des handlers pour chaque type d'événement
   - Tester chaque handler

### Phase 3: Job Handlers (Priorité ⭐⭐⭐⭐)

6. **Créer les Job Handlers**
   - RunAgentHandler
   - CreateSessionHandler
   - PushToGitHubHandler
   - GenerateImageHandler
   - GenerateVideoHandler
   - StealAppHandler

7. **Intégrer avec Agent Runtime**
   - Utiliser AgentRuntime dans RunAgentHandler
   - Tester l'exécution de l'agent

### Phase 4: Advanced Features (Priorité ⭐⭐⭐)

8. **Ajouter le Retry Mechanism**
   - Implémenter le retry avec exponentiel backoff
   - Tester avec des échecs simulés

9. **Ajouter le Concurrency Control**
   - Implémenter la limite de concurrency
   - Tester avec des jobs simultanés

10. **Ajouter le Timeout**
    - Implémenter le timeout pour les jobs
    - Tester avec des jobs longs

---

## 📚 RÉFÉRENCES

- [Inngest Documentation](https://www.inngest.com/docs)
- [Inngest Functions](https://www.inngest.com/docs/functions)
- [Inngest Events](https://www.inngest.com/docs/events)
- [Inngest Retries](https://www.inngest.com/docs/functions/retries)
- [Inngest Concurrency](https://www.inngest.com/docs/functions/concurrency)
- [Vibra Code Inngest](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest.ts)
- [Vibra Code Run Agent](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/run-agent.ts)
- [Vibra Code Create Session](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/create-session.ts)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
