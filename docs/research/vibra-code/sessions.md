# Vibra Code - Session System Analysis

> **Projet**: Extraction du Session System de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [Session Architecture](#-session-architecture)
3. [Session Schema](#-session-schema)
4. [Session Lifecycle](#-session-lifecycle)
5. [Session Creation](#-session-creation)
6. [Session Management](#-session-management)
7. [Session Resume](#-session-resume)
8. [Session Stop](#-session-stop)
9. [Session Cost Tracking](#-session-cost-tracking)
10. [Session Environment](#-session-environment)
11. [Session GitHub Integration](#-session-github-integration)
12. [Session State Management](#-session-state-management)
13. [Comparison avec SoryOS](#-comparison-avec-soryos)
14. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture du Session System

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VIBRA CODE SESSION SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   USER      │    │   API       │    │  INNGEST    │              │
│  │  Request    │───►│  Route      │───►│  Function    │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SESSION CREATION                            │   │
│  │  - Generate session ID                                        │   │
│  │  - Create Convex DB record                                    │   │
│  │  - Create E2B sandbox                                         │   │
│  │  - Start dev server                                           │   │
│  │  - Trigger agent                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SESSION MANAGEMENT                           │   │
│  │  - Update status                                              │   │
│  │  - Add messages                                               │   │
│  │  - Track cost                                                 │   │
│  │  - Manage environment variables                               │   │
│  │  - Handle GitHub integration                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SESSION STATE                                │   │
│  │  - IN_PROGRESS                                                 │   │
│  │  - CLONING_REPO                                               │   │
│  │  - INSTALLING_DEPENDENCIES                                    │   │
│  │  - STARTING_DEV_SERVER                                        │   │
│  │  - CREATING_TUNNEL                                           │   │
│  │  - RUNNING                                                   │   │
│  │  - CUSTOM (working on task)                                   │   │
│  │  - PUSHING_TO_GITHUB                                          │   │
│  │  - ... (15+ states)                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SESSION PERSISTENCE                           │   │
│  │  - Convex DB (sessions table)                                 │   │
│  │  - Messages table                                             │   │
│  │  - Costs table                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SESSION REALTIME                              │   │
│  │  - Convex subscriptions                                       │   │
│  │  - Streaming updates to client                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `convex/schema.ts` | Schema de la base de données | ⭐⭐⭐⭐⭐ | 500+ |
| `convex/sessions.ts` | Queries/Mutations des sessions | ⭐⭐⭐⭐⭐ | 300+ |
| `lib/inngest/functions/create-session.ts` | Création de session | ⭐⭐⭐⭐⭐ | 150+ |
| `app/actions/sessions/` | Server Actions des sessions | ⭐⭐⭐⭐ | 200+ |
| `app/api/session/` | API Routes des sessions | ⭐⭐⭐⭐ | 300+ |

---

## 🏗️ SESSION ARCHITECTURE

### Concepts de Base

Dans Vibra Code, une **session** représente:

1. **Une conversation** entre l'utilisateur et l'agent
2. **Un environnement d'exécution** (E2B sandbox)
3. **Un état** (status, messages, cost, etc.)
4. **Un projet** (code, dependencies, configuration)

### Composants d'une Session

```
SESSION
├── Metadata
│   ├── sessionId (E2B sandbox ID)
│   ├── dbId (Convex ID)
│   ├── name
│   ├── createdBy (Clerk user ID)
│   └── createdAt
│
├── State
│   ├── status (IN_PROGRESS, RUNNING, CUSTOM, etc.)
│   ├── statusMessage
│   └── agentStopped
│
├── Environment
│   ├── templateId
│   ├── tunnelUrl
│   ├── envs (environment variables)
│   └── convexProject
│
├── GitHub
│   ├── githubRepository
│   ├── githubRepositoryUrl
│   ├── githubPushStatus
│   └── githubPushDate
│
├── Cost
│   ├── totalCostUSD
│   ├── messageCount
│   └── lastCostUpdate
│
└── Messages
    ├── user messages
    ├── assistant messages
    ├── tool calls
    ├── tool results
    ├── edits
    └── todos
```

---

## 📋 SESSION SCHEMA

### Schema Convex

**Source**: `vibracode-backend/convex/schema.ts`

```typescript
export default defineSchema({
  sessions: defineTable({
    // Ownership
    createdBy: v.optional(v.string()),      // Clerk user ID
    
    // Identification
    sessionId: v.optional(v.string()),       // E2B sandbox ID
    name: v.string(),                       // Session name
    
    // Preview
    tunnelUrl: v.optional(v.string()),       // Preview URL
    
    // Repository
    repository: v.optional(v.string()),      // GitHub repository (legacy)
    templateId: v.string(),                  // Template utilisé
    pullRequest: v.optional(v.any()),        // PR info (legacy)
    
    // GitHub
    githubRepository: v.optional(v.string()), // Full repository name (owner/repo)
    githubRepositoryUrl: v.optional(v.string()), // GitHub repository URL
    githubPushStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('failed')
      )
    ),
    githubPushDate: v.optional(v.number()),   // Timestamp when pushed to GitHub
    
    // Status
    status: v.union(
      v.literal('IN_PROGRESS'),
      v.literal('CLONING_REPO'),
      v.literal('INSTALLING_DEPENDENCIES'),
      v.literal('STARTING_DEV_SERVER'),
      v.literal('CREATING_TUNNEL'),
      v.literal('CUSTOM'),
      v.literal('RUNNING'),
      v.literal('CREATING_GITHUB_REPO'),
      v.literal('SETTING_UP_SANDBOX'),
      v.literal('INITIALIZING_GIT'),
      v.literal('ADDING_FILES'),
      v.literal('COMMITTING_CHANGES'),
      v.literal('PUSHING_TO_GITHUB'),
      v.literal('PUSH_COMPLETE'),
      v.literal('PUSH_FAILED'),
      v.literal('AUTO_PUSHING'),
      v.literal('USING_EXISTING_REPO')
    ),
    statusMessage: v.optional(v.string()),
    
    // Agent control
    agentStopped: v.optional(v.boolean()),   // True when user manually stops the agent
    
    // Cost tracking
    totalCostUSD: v.optional(v.number()),     // Total cost for this session
    messageCount: v.optional(v.number()),      // Number of messages in this session
    lastCostUpdate: v.optional(v.number()),   // Timestamp of last cost update
    
    // Environment Variables
    envs: v.optional(v.record(v.string(), v.string())), // Key-value pairs
    
    // Convex Project Information
    convexProject: v.optional(
      v.object({
        deploymentName: v.string(),
        deploymentUrl: v.string(),
        adminKey: v.string(),
        projectSlug: v.optional(v.string()),
        teamSlug: v.optional(v.string()),
      })
    ),
  })
    .index('by_createdBy', ['createdBy'])
    .index('by_status', ['status'])
    .index('by_totalCostUSD', ['totalCostUSD'])
    .index('by_templateId', ['templateId']),
  
  messages: defineTable({
    sessionId: v.id('sessions'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    metadata: v.optional(v.any()),
    edits: v.optional(
      v.object({
        filePath: v.string(),
        oldString: v.string(),
        newString: v.string(),
      })
    ),
    todos: v.optional(
      v.array(
        v.object({
          id: v.string(),
          status: v.union(v.literal('in_progress'), v.literal('completed')),
          description: v.string(),
        })
      )
    ),
    toolCalls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          arguments: v.any(),
          result: v.optional(v.any()),
        })
      )
    ),
  })
    .index('by_session', ['sessionId']),
});
```

### Indexes

Les indexes permettent des requêtes optimisées:

- `by_createdBy`: Liste des sessions d'un utilisateur
- `by_status`: Filtrage par statut
- `by_totalCostUSD`: Tri par coût
- `by_templateId`: Filtrage par template
- `by_session` (messages): Filtrage des messages par session

---

## 🔄 SESSION LIFECYCLE

### États d'une Session

```
IN_PROGRESS
  │
  ▼
CLONING_REPO (si repository fourni)
  │
  ▼
INSTALLING_DEPENDENCIES (skip si template pré-configuré)
  │
  ▼
SETTING_UP_SANDBOX
  │
  ▼
STARTING_DEV_SERVER
  │
  ▼
CREATING_TUNNEL
  │
  ▼
RUNNING (Agent démarre)
  │
  ▼
CUSTOM (Tâche en cours)
  │
  ▼
RUNNING (Agent continue)
  │   
  ├───► CUSTOM (Nouvelle tâche)
  │       │
  │       ▼
  │    RUNNING
  │
  └───► PUSHING_TO_GITHUB (si auto-push activé)
          │
          ▼
       PUSH_COMPLETE
          │
          ▼
        RUNNING
```

### Détail des États

| État | Description | Actions |
|------|-------------|--------|
| `IN_PROGRESS` | Session en cours de création | Initialisation |
| `CLONING_REPO` | Clonage du repository GitHub | `git clone` |
| `INSTALLING_DEPENDENCIES` | Installation des dépendances | `npm install` |
| `SETTING_UP_SANDBOX` | Configuration de la sandbox | Setup E2B |
| `STARTING_DEV_SERVER` | Démarrage du serveur de dev | `npx expo start` |
| `CREATING_TUNNEL` | Création du tunnel | Expo tunnel |
| `RUNNING` | Session active, agent prêt | Attente des messages |
| `CUSTOM` | Agent en train de travailler | Exécution de tâches |
| `CREATING_GITHUB_REPO` | Création du repo GitHub | Octokit |
| `INITIALIZING_GIT` | Initialisation de git | `git init` |
| `ADDING_FILES` | Ajout des fichiers à git | `git add` |
| `COMMITTING_CHANGES` | Commit des changements | `git commit` |
| `PUSHING_TO_GITHUB` | Push vers GitHub | `git push` |
| `PUSH_COMPLETE` | Push terminé | Success |
| `PUSH_FAILED` | Push échoué | Error handling |
| `AUTO_PUSHING` | Auto-push en cours | Push automatique |
| `USING_EXISTING_REPO` | Utilisation d'un repo existant | Skip setup |

---

## 🆕 SESSION CREATION

### Flow de Création

```
USER
  │
  ▼
┌─────────────────────┐
│  Select Template      │  (Blank, React Native, Next.js, etc.)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Send Message        │  (Premier message utilisateur)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST /api/create-  │
│  session             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Generate Session ID │  (UUID v4)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Create Convex       │
│  Session Record      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Send Inngest Event  │  (vibracode/create.session)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Inngest Function    │  (createSession)
│  - Create E2B        │
│    Sandbox          │
│  - Generate title   │
│  - Update status    │
│  - Start dev server │
│  - Trigger agent    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Session Ready       │  (Tunnel URL disponible)
└─────────────────────┘
```

### Code de Création

**Source**: `app/api/create-session/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { templates } from '@/config';
import { getGitHubToken } from '@/lib/auth/clerk';
import { createErrorResponse, handleApiError, validateRequiredFields } from '@/lib/api/error-handler';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body = await request.json();
    const { sessionId, message, templateId, repository, userId } = body;

    // 2. Validate required fields
    const validationError = validateRequiredFields(body, ['sessionId', 'userId']);
    if (validationError) {
      return createErrorResponse(validationError, 400);
    }

    // 3. Resolve template
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      return createErrorResponse(`Template with id "${templateId}" not found`, 400);
    }

    console.log('Creating session for user:', userId, 'with sessionId:', sessionId, 'template:', template.name);

    // 4. Get GitHub OAuth token
    let githubToken = "";
    try {
      githubToken = await getGitHubToken(userId);
      console.log('GitHub token found:', githubToken ? 'Yes' : 'No');
    } catch (error) {
      console.error("Error getting GitHub OAuth token:", error);
    }

    // 5. Send Inngest event
    const { inngest } = await import('@/lib/inngest');
    
    await inngest.send({
      name: "vibracode/create.session",
      data: {
        sessionId,
        message,
        repository,
        token: githubToken,
        template,
      },
    });

    // 6. Return success
    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Session creation started',
    });

  } catch (error) {
    console.error('Error in create-session API:', error);
    return handleApiError(error);
  }
}
```

### Inngest Function: createSession

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

    // 1. Create E2B manager
    const e2bManager = new E2BManager({
      templateId: template?.image || "YOUR_E2B_TEMPLATE_ID",
      envVars: template?.secrets || {}
    });

    // 2. Create sandbox and trigger agent
    const sandboxData = await step.run("create sandbox", async () => {
      const title = await generateSessionTitle(message);

      const { fetchMutation } = await import("convex/nextjs");
      const { api } = await import("@/convex/_generated/api");

      // Update session status
      await fetchMutation(api.sessions.update, {
        id,
        status: "CLONING_REPO",
        name: title,
      });

      // Create the sandbox
      const sandbox = await e2bManager.createSandbox();

      return {
        sandboxId: sandbox.sandboxId,
        title,
      };
    });

    // 3. Trigger agent IMMEDIATELY
    if (message) {
      await step.run("run agent early", async () => {
        console.log("🚀 Triggering Claude agent immediately after sandbox creation");
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

    // 4. Start dev server in parallel
    const data = await step.run("start dev server", async () => {
      // Reconnect to sandbox
      await e2bManager.connectToSandbox(sandboxData.sandboxId);

      if (!repository && template) {
        // For custom templates, everything is pre-configured
        await updateSessionStatus(id, "STARTING_DEV_SERVER");

        // Start the dev server
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

        // Start expo dev server
        await e2bManager.executeCommand("echo fs.inotify.max_user_watches=524288 >> /etc/sysctl.conf && sysctl -p && npx expo start --tunnel --port 3000", {
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

    // 5. Update session with tunnel URL
    await step.run("update session", async () => {
      await updateSessionStatus(id, "RUNNING", undefined, data.tunnelUrl, data.sandboxId);
    });

    return data;
  }
);
```

---

## 🔧 SESSION MANAGEMENT

### Queries Convex

**Source**: `convex/sessions.ts`

```typescript
// Liste des sessions d'un utilisateur
export const list = query({
  args: {
    createdBy: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Sécurité: toujours vérifier createdBy
    if (!args.createdBy) {
      console.warn('sessions.list called without createdBy - returning empty array for security');
      return [];
    }

    // Limite par défaut: 100, max: 500
    const limit = Math.min(args.limit || 100, 500);

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_createdBy', (q) => q.eq('createdBy', args.createdBy))
      .order('desc')
      .take(limit);

    // Retourne seulement les champs essentiels
    return sessions.map((session) => ({
      id: session._id,
      _id: session._id,
      _creationTime: session._creationTime,
      name: session.name,
      status: session.status,
      statusMessage: session.statusMessage,
      tunnelUrl: session.tunnelUrl,
      templateId: session.templateId,
      createdBy: session.createdBy,
      sessionId: session.sessionId,
      githubRepository: session.githubRepository,
      githubRepositoryUrl: session.githubRepositoryUrl,
      githubPushStatus: session.githubPushStatus,
      messages: [], // Vide - chargé séparément
    }));
  },
});

// Récupère une session spécifique
export const getById = query({
  args: {
    id: v.id('sessions'),
    createdBy: v.string(), // Vérification de propriété obligatoire
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    // Vérification de propriété
    if (session.createdBy !== args.createdBy) {
      console.warn(
        `SECURITY: BLOCKED - User ${args.createdBy} attempted to access session ${args.id} owned by ${session.createdBy}`
      );
      return null;
    }

    // Charger les messages
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.id))
      .order('asc')
      .collect();

    return {
      ...session,
      id: session._id,
      messages: messages.map((msg) => ({
        ...msg,
        id: msg._id,
      })),
    };
  },
});

// Query interne (backend only) - contourne la vérification de propriété
export const getByIdInternal = query({
  args: {
    id: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.id))
      .order('asc')
      .collect();

    return {
      ...session,
      id: session._id,
      messages: messages.map((msg) => ({
        ...msg,
        id: msg._id,
      })),
    };
  },
});
```

### Mutations Convex

```typescript
// Création d'une session
export const create = mutation({
  args: {
    name: v.string(),
    templateId: v.string(),
    createdBy: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionId = args.sessionId || crypto.randomUUID();
    
    return await ctx.db.insert('sessions', {
      name: args.name,
      templateId: args.templateId,
      createdBy: args.createdBy,
      sessionId,
      status: 'IN_PROGRESS',
      statusMessage: 'Creating session',
      envs: {},
      totalCostUSD: 0,
      messageCount: 0,
    });
  },
});

// Mise à jour d'une session
export const update = mutation({
  args: {
    id: v.id('sessions'),
    name: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal('IN_PROGRESS'),
      v.literal('CLONING_REPO'),
      // ... tous les états
    )),
    statusMessage: v.optional(v.string()),
    tunnelUrl: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    githubRepository: v.optional(v.string()),
    githubRepositoryUrl: v.optional(v.string()),
    githubPushStatus: v.optional(v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed')
    )),
    agentStopped: v.optional(v.boolean()),
    envs: v.optional(v.record(v.string(), v.string())),
    totalCostUSD: v.optional(v.number()),
    messageCount: v.optional(v.number()),
    lastCostUpdate: v.optional(v.number()),
    convexProject: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new Error('Session not found');
    }

    // Vérification de propriété
    if (session.createdBy !== (await ctx.auth.getUserIdentity())?.tokenIdentifier) {
      throw new Error('Unauthorized');
    }

    return await ctx.db.patch(args.id, {
      name: args.name,
      status: args.status,
      statusMessage: args.statusMessage,
      tunnelUrl: args.tunnelUrl,
      sessionId: args.sessionId,
      githubRepository: args.githubRepository,
      githubRepositoryUrl: args.githubRepositoryUrl,
      githubPushStatus: args.githubPushStatus,
      agentStopped: args.agentStopped,
      envs: args.envs,
      totalCostUSD: args.totalCostUSD,
      messageCount: args.messageCount,
      lastCostUpdate: args.lastCostUpdate,
      convexProject: args.convexProject,
    });
  },
});

// Suppression d'une session
export const remove = mutation({
  args: {
    id: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new Error('Session not found');
    }

    // Vérification de propriété
    if (session.createdBy !== (await ctx.auth.getUserIdentity())?.tokenIdentifier) {
      throw new Error('Unauthorized');
    }

    // Supprimer les messages de la session
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.id))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Supprimer la session
    await ctx.db.delete(args.id);
  },
});
```

---

## 🔄 SESSION RESUME

### Flow de Reprise

```
USER
  │
  ▼
┌─────────────────────┐
│  Select Existing     │  (Session à reprendre)
│  Session            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST /api/session/  │
│  resume              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Get Session Data    │  (Convex DB)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Connect to E2B      │  (Reconnect to existing sandbox)
│  Sandbox            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Reset Agent        │  (agentStopped = false)
│  Stopped Flag       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Trigger Agent       │  (Nouveau message ou "continue")
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Session Resumed     │  (Agent reprend où il s'était arrêté)
└─────────────────────┘
```

### Code de Reprise

**Source**: `app/api/session/resume/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateRequiredFields, createErrorResponse, handleApiError } from '@/lib/api/error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, id, userId } = body;

    // Validation
    const validationError = validateRequiredFields(body, ['sessionId', 'id', 'userId']);
    if (validationError) {
      return createErrorResponse(validationError, 400);
    }

    // Get session data
    const { fetchQuery } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");
    
    const session = await fetchQuery(api.sessions.getById, {
      id: id as Id<"sessions">,
      createdBy: userId,
    });

    if (!session) {
      return createErrorResponse('Session not found', 404);
    }

    // Reset agentStopped flag
    const { fetchMutation } = await import("convex/nextjs");
    await fetchMutation(api.sessions.update, {
      id: id as Id<"sessions">,
      agentStopped: false,
    });

    // Trigger agent
    const { inngest } = await import('@/lib/inngest');
    await inngest.send({
      name: "vibracode/run.agent",
      data: {
        sessionId: session.sessionId,
        id,
        message: "continue", // Message par défaut pour la reprise
        template: session.templateId,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      message: 'Session resumed',
    });

  } catch (error) {
    console.error('Error in resume API:', error);
    return handleApiError(error);
  }
}
```

---

## 🛑 SESSION STOP

### Flow d'Arrêt

```
USER
  │
  ▼
┌─────────────────────┐
│  Click Stop Button   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST /api/session/  │
│  stop-agent          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Set agentStopped    │  (true dans Convex DB)
│  Flag               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Agent Stops         │  (Après la commande en cours)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Session Stopped     │  (Peut être repris plus tard)
└─────────────────────┘
```

### Code d'Arrêt

**Source**: `app/api/session/stop-agent/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateRequiredFields, createErrorResponse, handleApiError } from '@/lib/api/error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userId } = body;

    // Validation
    const validationError = validateRequiredFields(body, ['id', 'userId']);
    if (validationError) {
      return createErrorResponse(validationError, 400);
    }

    // Set agentStopped flag
    const { fetchMutation } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");
    
    await fetchMutation(api.sessions.update, {
      id: id as Id<"sessions">,
      agentStopped: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Agent stopped',
    });

  } catch (error) {
    console.error('Error in stop-agent API:', error);
    return handleApiError(error);
  }
}
```

---

## 💰 SESSION COST TRACKING

### Mécanisme de Tracking

**Sources**: `lib/inngest/functions/run-agent.ts`, `convex/costs.ts`

```typescript
// Dans run-agent.ts
let accumulatedCost = 0;
let accumulatedStdout = "";

const handleStdout = async (data: string) => {
  accumulatedStdout += data + "\n";
  
  // Extraction des infos de coût depuis le stdout
  const costInfo = extractCostFromOutput(data);
  accumulatedCost += costInfo.cost;
  
  // Mise à jour périodique dans la DB
  if (accumulatedCost >= UPDATE_THRESHOLD) {
    await updateSessionCost(id, accumulatedCost);
    accumulatedCost = 0;
  }
};

// Extraction des coûts depuis le stdout
const extractCostFromOutput = (output: string): { cost: number } => {
  // Pour Claude: extraction des tokens utilisés
  const claudeCostMatch = output.match(/Input tokens: (\d+), Output tokens: (\d+)/);
  if (claudeCostMatch) {
    const inputTokens = parseInt(claudeCostMatch[1]);
    const outputTokens = parseInt(claudeCostMatch[2]);
    const totalTokens = inputTokens + outputTokens;
    
    // Coût basé sur le modèle (ex: Opus = $15/M tokens, Sonnet = $3/M tokens)
    const costPerMillion = getCostPerMillion(model);
    const cost = (totalTokens / 1_000_000) * costPerMillion;
    
    return { cost };
  }
  
  // Pour Cursor: coût basé sur le nombre de messages
  const cursorCostMatch = output.match(/Messages used: (\d+)/);
  if (cursorCostMatch) {
    const messages = parseInt(cursorCostMatch[1]);
    const costPerMessage = 0.002; // $0.002 par message
    const cost = messages * costPerMessage;
    
    return { cost };
  }
  
  return { cost: 0 };
};
```

### Schema des Coûts

**Source**: `convex/costs.ts`

```typescript
export default defineSchema({
  costs: defineTable({
    sessionId: v.id('sessions'),
    timestamp: v.number(),
    costUSD: v.number(),
    provider: v.string(), // 'claude', 'cursor', 'gemini'
    model: v.string(),    // 'opus', 'sonnet', 'auto', etc.
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    messagesUsed: v.optional(v.number()),
    operation: v.string(), // 'completion', 'edit', 'tool_call', etc.
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_timestamp', ['timestamp']),
});
```

### Pre-flight Billing Check

**Source**: `app/actions/agents/run.ts`

```typescript
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

## 🌍 SESSION ENVIRONMENT

### Variables d'Environnement

Les variables d'environnement sont stockées dans la session et injectées dans la sandbox:

```typescript
// Dans create-session.ts
await fetchMutation(api.sessions.update, {
  id,
  envs: {
    ...template.secrets,
    ...userEnvs,
  },
});

// Dans E2BManager
await sandbox.files.write('/vibe0/.env.local', 
  Object.entries(envs).map(([key, value]) => `${key}=${value}`).join('\n')
);
```

### Gestion des Secrets

```typescript
// Secrets par template
template: {
  id: 'react-native',
  name: 'React Native',
  secrets: {
    API_KEY: 'default-api-key',
    BASE_URL: 'https://api.example.com',
  },
}

// Secrets utilisateur
userEnvs: {
  GITHUB_TOKEN: 'ghp_xxx',
  ANTHROPIC_API_KEY: 'sk-ant-xxx',
}

// Combinaison
sessionEnvs: {
  ...template.secrets,
  ...userEnvs,
}
```

---

## 🔗 SESSION GITHUB INTEGRATION

### Flow GitHub

```
SESSION
  │
  ▼
┌─────────────────────┐
│  User Requests       │  (Push to GitHub)
│  GitHub Push         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST /api/session/  │
│  push-to-github      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Send Inngest Event  │  (vibracode/push.to.github)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Inngest Function    │  (pushToGitHub)
│  - Initialize git    │
│  - Commit changes    │
│  - Push to GitHub    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Update Session      │  (githubPushStatus, githubPushDate)
│  Status             │
└─────────────────────┘
```

### Code de Push vers GitHub

**Source**: `lib/inngest/functions/push-to-github.ts`

```typescript
export const pushToGitHub = inngest.createFunction(
  { id: "push-to-github", retries: 2 },
  { event: "vibracode/push.to.github" },
  async ({ event, step }) => {
    const { id, token, repository } = event.data;

    const e2bManager = new E2BManager();
    await e2bManager.connectToSandbox(id);

    // Update status
    await step.run("update status", async () => {
      await updateSessionStatus(id, "PUSHING_TO_GITHUB");
    });

    // Commit and push
    const result = await step.run("commit and push", async () => {
      return await e2bManager.commitAndPush(
        token,
        repository,
        `Vibra Code: ${new Date().toISOString()}`,
        false // isInitialPush
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

### Auto-Push

Vibra supporte l'auto-push après chaque modification majeure:

```typescript
// Dans run-agent.ts
if (AUTO_PUSH_ENABLED) {
  await step.run("auto push", async () => {
    if (hasSignificantChanges) {
      await inngest.send({
        name: "vibracode/push.to.github",
        data: {
          id,
          token: sessionData.token,
          repository: sessionData.githubRepository,
        },
      });
    }
  });
}
```

---

## 🎛️ SESSION STATE MANAGEMENT

### updateSessionStatus

**Source**: `lib/inngest/middleware.ts`

```typescript
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
```

### addMessage

**Source**: `lib/inngest/middleware.ts`

```typescript
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

    // Mise à jour du message count
    await fetchMutation(api.sessions.update, {
      id: sessionId,
      messageCount: await getMessageCount(sessionId) + 1,
    });

    return messageId;
  } catch (error) {
    console.warn('⚠️ Non-fatal: Failed to add message:', error);
    return null;
  }
};
```

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| Session Schema | ✅ | ⭐ | ⭐⭐⭐ |
| Session Lifecycle | ✅ | ⭐ | ⭐⭐ |
| Session Creation | ✅ | ✅ | ⭐⭐⭐⭐ |
| Session Management | ✅ | ✅ | ⭐⭐⭐ |
| Session Resume | ✅ | ⭐ | ⭐ |
| Session Stop | ✅ | ⭐ | ⭐ |
| Cost Tracking | ✅ | ⭐ | ⭐ |
| Environment Variables | ✅ | ✅ | ⭐⭐⭐⭐ |
| GitHub Integration | ✅ | ✅ | ⭐⭐⭐ |
| State Management | ✅ | ✅ | ⭐⭐⭐⭐ |
| Realtime Updates | ✅ | ⭐ | ⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| Session Schema | Très complet (20+ champs) | À définir | **Adapter** |
| Session Lifecycle | 15+ états | À définir | **Adapter** |
| Session Creation | Inngest Function | À implémenter | **Adapter** |
| Cost Tracking | Très détaillé | À implémenter | **Implémenter** |
| Auto-Push | ✅ | ⭐ | **Ajouter** |
| Pre-flight Check | ✅ | ⭐ | **Ajouter** |

### Avantages Vibra à Extraire

1. **Session Schema Complet**: Tous les champs nécessaires pour une session riche
2. **Lifecycle Détaillé**: 15+ états pour un suivi précis
3. **Cost Tracking**: Suivi précis des coûts par session
4. **Pre-flight Billing Check**: Vérification avant chaque exécution
5. **Auto-Push**: Push automatique vers GitHub
6. **Environment Management**: Gestion complète des variables d'environnement
7. **State Management**: Mise à jour robuste du statut

### Points à Améliorer dans SoryOS

1. **Session Schema**: Doit être aussi complet que Vibra
2. **Session Lifecycle**: Doit supporter tous les états nécessaires
3. **Session Creation**: Doit être aussi robuste que Vibra
4. **Cost Tracking**: Doit tracker les coûts par session
5. **Pre-flight Check**: Doit vérifier les crédits avant exécution

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. Session State (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/session/src/state.rs

use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub id: String,                    // Session ID (E2B sandbox ID)
    pub db_id: String,                 // Database ID
    pub name: String,                  // Session name
    pub workspace_id: String,          // Workspace ID
    pub project_id: String,            // Project ID
    
    // Status
    pub status: SessionStatus,
    pub status_message: Option<String>,
    pub agent_stopped: bool,
    
    // Environment
    pub template_id: String,
    pub tunnel_url: Option<String>,
    pub envs: HashMap<String, String>,
    
    // GitHub
    pub github_repository: Option<String>,
    pub github_repository_url: Option<String>,
    pub github_push_status: Option<GitHubPushStatus>,
    pub github_push_date: Option<i64>,
    
    // Cost
    pub total_cost_usd: f64,
    pub message_count: i32,
    pub last_cost_update: Option<i64>,
    
    // Metadata
    pub created_by: String,            // User ID
    pub created_at: i64,              // Timestamp
    pub updated_at: i64,              // Timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize, strum::Display)]
pub enum SessionStatus {
    InProgress,
    CloningRepo,
    InstallingDependencies,
    SettingUpSandbox,
    StartingDevServer,
    CreatingTunnel,
    Running,
    Custom,
    CreatingGitHubRepo,
    InitializingGit,
    AddingFiles,
    CommittingChanges,
    PushingToGitHub,
    PushComplete,
    PushFailed,
    AutoPushing,
    UsingExistingRepo,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, strum::Display)]
pub enum GitHubPushStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            id: String::new(),
            db_id: String::new(),
            name: String::new(),
            workspace_id: String::new(),
            project_id: String::new(),
            status: SessionStatus::InProgress,
            status_message: None,
            agent_stopped: false,
            template_id: String::new(),
            tunnel_url: None,
            envs: HashMap::new(),
            github_repository: None,
            github_repository_url: None,
            github_push_status: None,
            github_push_date: None,
            total_cost_usd: 0.0,
            message_count: 0,
            last_cost_update: None,
            created_by: String::new(),
            created_at: 0,
            updated_at: 0,
        }
    }
}
```

#### 2. Session Manager (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/session/src/manager.rs

use std::sync::Arc;
use async_trait::async_trait;
use tokio::sync::RwLock;

#[async_trait]
pub trait SessionManager: Send + Sync {
    async fn create(&self, request: CreateSessionRequest) -> Result<SessionState, SessionError>;
    async fn get(&self, session_id: &str) -> Result<SessionState, SessionError>;
    async fn list(&self, user_id: &str, limit: Option<usize>) -> Result<Vec<SessionState>, SessionError>;
    async fn update(&self, session_id: &str, update: SessionUpdate) -> Result<SessionState, SessionError>;
    async fn delete(&self, session_id: &str) -> Result<(), SessionError>;
    async fn resume(&self, session_id: &str, user_id: &str) -> Result<SessionState, SessionError>;
    async fn stop(&self, session_id: &str, user_id: &str) -> Result<SessionState, SessionError>;
    async fn add_message(&self, session_id: &str, message: Message) -> Result<(), SessionError>;
    async fn update_status(&self, session_id: &str, status: SessionStatus, message: Option<&str>) -> Result<(), SessionError>;
    async fn update_cost(&self, session_id: &str, cost: f64) -> Result<(), SessionError>;
}

#[derive(Debug, Clone)]
pub struct SessionManagerImpl {
    db: Arc<dyn Database>,
    execution_provider: Arc<dyn ExecutionProvider>,
    github_manager: Arc<GitHubManager>,
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
}

#[async_trait]
impl SessionManager for SessionManagerImpl {
    async fn create(&self, request: CreateSessionRequest) -> Result<SessionState, SessionError> {
        // 1. Generate session ID
        let session_id = uuid::Uuid::new_v4().to_string();
        
        // 2. Create database record
        let db_id = self.db.create_session(&request).await?;
        
        // 3. Create execution provider sandbox
        let sandbox = self.execution_provider.create_sandbox(&request.template_id).await?;
        
        // 4. Store session state
        let mut state = SessionState {
            id: session_id.clone(),
            db_id: db_id.clone(),
            name: request.name,
            workspace_id: request.workspace_id,
            project_id: request.project_id,
            status: SessionStatus::SettingUpSandbox,
            status_message: Some("Setting up sandbox...".to_string()),
            agent_stopped: false,
            template_id: request.template_id,
            tunnel_url: None,
            envs: request.envs,
            github_repository: request.github_repository,
            github_repository_url: None,
            github_push_status: None,
            github_push_date: None,
            total_cost_usd: 0.0,
            message_count: 0,
            last_cost_update: None,
            created_by: request.user_id,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
        };
        
        // 5. Store in memory
        self.sessions.write().await.insert(session_id.clone(), state.clone());
        
        // 6. Start dev server and trigger agent
        self.start_dev_server(&session_id, &request).await?;
        
        Ok(state)
    }
    
    async fn get(&self, session_id: &str) -> Result<SessionState, SessionError> {
        if let Some(session) = self.sessions.read().await.get(session_id) {
            return Ok(session.clone());
        }
        
        // Load from database
        let session = self.db.get_session(session_id).await?;
        Ok(session)
    }
    
    async fn list(&self, user_id: &str, limit: Option<usize>) -> Result<Vec<SessionState>, SessionError> {
        let limit = limit.unwrap_or(100);
        let sessions = self.db.list_sessions(user_id, limit).await?;
        Ok(sessions)
    }
    
    async fn update(&self, session_id: &str, update: SessionUpdate) -> Result<SessionState, SessionError> {
        let mut session = self.get(session_id).await?;
        
        if let Some(name) = update.name {
            session.name = name;
        }
        if let Some(status) = update.status {
            session.status = status;
        }
        if let Some(status_message) = update.status_message {
            session.status_message = Some(status_message);
        }
        if let Some(tunnel_url) = update.tunnel_url {
            session.tunnel_url = Some(tunnel_url);
        }
        if let Some(envs) = update.envs {
            session.envs = envs;
        }
        if let Some(github_repository) = update.github_repository {
            session.github_repository = Some(github_repository);
        }
        if let Some(total_cost_usd) = update.total_cost_usd {
            session.total_cost_usd = total_cost_usd;
        }
        if let Some(message_count) = update.message_count {
            session.message_count = message_count;
        }
        
        session.updated_at = chrono::Utc::now().timestamp();
        
        // Update in memory
        self.sessions.write().await.insert(session_id.to_string(), session.clone());
        
        // Update in database
        self.db.update_session(session_id, &session).await?;
        
        Ok(session)
    }
    
    async fn delete(&self, session_id: &str) -> Result<(), SessionError> {
        // Stop sandbox
        self.execution_provider.kill_sandbox(session_id).await?;
        
        // Delete from memory
        self.sessions.write().await.remove(session_id);
        
        // Delete from database
        self.db.delete_session(session_id).await?;
        
        Ok(())
    }
    
    async fn resume(&self, session_id: &str, user_id: &str) -> Result<SessionState, SessionError> {
        let mut session = self.get(session_id).await?;
        
        // Verify ownership
        if session.created_by != user_id {
            return Err(SessionError::Unauthorized);
        }
        
        // Reset agent stopped flag
        session.agent_stopped = false;
        session.status = SessionStatus::Running;
        session.status_message = Some("Resumed".to_string());
        
        // Reconnect to sandbox
        self.execution_provider.connect_to_sandbox(session_id).await?;
        
        // Update in memory and database
        self.update(session_id, SessionUpdate {
            agent_stopped: Some(false),
            status: Some(SessionStatus::Running),
            status_message: Some("Resumed".to_string()),
            ..Default::default()
        }).await?;
        
        Ok(session)
    }
    
    async fn stop(&self, session_id: &str, user_id: &str) -> Result<SessionState, SessionError> {
        let mut session = self.get(session_id).await?;
        
        // Verify ownership
        if session.created_by != user_id {
            return Err(SessionError::Unauthorized);
        }
        
        // Set agent stopped flag
        session.agent_stopped = true;
        session.status = SessionStatus::Stopped;
        session.status_message = Some("Stopped by user".to_string());
        
        // Update in memory and database
        self.update(session_id, SessionUpdate {
            agent_stopped: Some(true),
            status: Some(SessionStatus::Stopped),
            status_message: Some("Stopped by user".to_string()),
            ..Default::default()
        }).await?;
        
        Ok(session)
    }
    
    async fn add_message(&self, session_id: &str, message: Message) -> Result<(), SessionError> {
        // Add message to database
        self.db.add_message(session_id, &message).await?;
        
        // Update message count
        let session = self.get(session_id).await?;
        self.update(session_id, SessionUpdate {
            message_count: Some(session.message_count + 1),
            ..Default::default()
        }).await?;
        
        Ok(())
    }
    
    async fn update_status(&self, session_id: &str, status: SessionStatus, message: Option<&str>) -> Result<(), SessionError> {
        self.update(session_id, SessionUpdate {
            status: Some(status),
            status_message: message.map(|m| Some(m.to_string())),
            ..Default::default()
        }).await?;
        
        Ok(())
    }
    
    async fn update_cost(&self, session_id: &str, cost: f64) -> Result<(), SessionError> {
        let session = self.get(session_id).await?;
        let new_cost = session.total_cost_usd + cost;
        
        self.update(session_id, SessionUpdate {
            total_cost_usd: Some(new_cost),
            last_cost_update: Some(chrono::Utc::now().timestamp()),
            ..Default::default()
        }).await?;
        
        Ok(())
    }
    
    async fn start_dev_server(&self, session_id: &str, request: &CreateSessionRequest) -> Result<(), SessionError> {
        // Connect to sandbox
        let sandbox = self.execution_provider.connect_to_sandbox(session_id).await?;
        
        // Start dev server based on template
        for command in &request.template.start_commands {
            self.update_status(session_id, SessionStatus::Custom, Some(&command.status)).await?;
            
            sandbox.execute(&command.command, ExecuteOptions {
                background: command.background,
                ..Default::default()
            }).await?;
        }
        
        // Get tunnel URL
        let tunnel_url = sandbox.get_host(3000).await?;
        
        // Update session
        self.update(session_id, SessionUpdate {
            tunnel_url: Some(tunnel_url),
            status: Some(SessionStatus::Running),
            status_message: Some("Ready".to_string()),
            ..Default::default()
        }).await?;
        
        Ok(())
    }
}
```

#### 3. Session Update (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/session/src/update.rs

#[derive(Debug, Clone, Default)]
pub struct SessionUpdate {
    pub name: Option<String>,
    pub status: Option<SessionStatus>,
    pub status_message: Option<Option<String>>,
    pub tunnel_url: Option<Option<String>>,
    pub template_id: Option<String>,
    pub envs: Option<HashMap<String, String>>,
    pub github_repository: Option<Option<String>>,
    pub github_repository_url: Option<Option<String>>,
    pub github_push_status: Option<Option<GitHubPushStatus>>,
    pub github_push_date: Option<Option<i64>>,
    pub total_cost_usd: Option<f64>,
    pub message_count: Option<i32>,
    pub last_cost_update: Option<Option<i64>>,
    pub agent_stopped: Option<bool>,
}
```

#### 4. Create Session Request (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/session/src/request.rs

#[derive(Debug, Clone)]
pub struct CreateSessionRequest {
    pub name: String,
    pub workspace_id: String,
    pub project_id: String,
    pub template_id: String,
    pub user_id: String,
    pub message: Option<String>,
    pub github_repository: Option<String>,
    pub envs: HashMap<String, String>,
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: Session System Foundation (Priorité ⭐⭐⭐⭐⭐)

1. **Définir les structures de données**
   - Créer `packages/session/src/state.rs`
   - Définir SessionState, SessionStatus, GitHubPushStatus
   - Tester la sérialisation/désérialisation

2. **Créer le SessionManager**
   - Créer `packages/session/src/manager.rs`
   - Implémenter create, get, list, update, delete
   - Tester avec des sessions mock

3. **Intégrer avec la base de données**
   - Adapter pour notre système de base de données
   - Tester la persistance

### Phase 2: Session Lifecycle (Priorité ⭐⭐⭐⭐⭐)

4. **Implémenter le lifecycle complet**
   - Créer `packages/session/src/lifecycle.rs`
   - Implémenter toutes les transitions d'état
   - Tester chaque transition

5. **Ajouter le Cost Tracking**
   - Créer `packages/session/src/cost.rs`
   - Implémenter le tracking des coûts
   - Tester avec des coûts mock

### Phase 3: Session Features (Priorité ⭐⭐⭐⭐)

6. **Implémenter Session Resume**
   - Ajouter la méthode resume au SessionManager
   - Tester la reprise de session

7. **Implémenter Session Stop**
   - Ajouter la méthode stop au SessionManager
   - Tester l'arrêt de session

8. **Ajouter GitHub Integration**
   - Intégrer avec GitHubManager
   - Tester le push vers GitHub

---

## 📚 RÉFÉRENCES

- [Vibra Code Session Schema](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/convex/schema.ts)
- [Vibra Code Sessions Queries](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/convex/sessions.ts)
- [Vibra Code Create Session](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/create-session.ts)
- [Vibra Code Run Agent](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/lib/inngest/functions/run-agent.ts)
- [Vibra Code Session API](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/app/api/session/)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
