# Vibra Code - Realtime System Analysis

> **Projet**: Extraction du Realtime System de Vibra Code  
> **Date**: 2025-10-08  
> **Version**: 1.0  
> **Statut**: Analyse Complète

---

## 🎯 SOMMAIRE

1. [Overview](#-overview)
2. [Convex Architecture](#-convex-architecture)
3. [Database Schema](#-database-schema)
4. [Queries & Mutations](#-queries--mutations)
5. [Subscriptions](#-subscriptions)
6. [Realtime Flow](#-realtime-flow)
7. [State Synchronization](#-state-synchronization)
8. [Offline Support](#-offline-support)
9. [Error Handling](#-error-handling)
10. [Comparison avec SoryOS](#-comparison-avec-soryos)
11. [Recommandations](#-recommandations)

---

## 📊 OVERVIEW

### Architecture du Realtime System

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VIBRA CODE REALTIME SYSTEM                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   CLIENT    │    │   CONVEX    │    │   DATABASE  │              │
│  │  (Mobile)   │◄───►│  (Backend)  │◄───►│  (Convex DB) │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SUBSCRIPTION FLOW                            │   │
│  │                                                                      │   │
│  │  1. Client subscribes to session/query                         │   │
│  │  2. Convex establishes WebSocket connection                    │   │
│  │  3. Database changes trigger updates                          │   │
│  │  4. Updates streamed to client via WebSocket                  │   │
│  │  5. Client UI updates in realtime                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    QUERY FLOW                                   │   │
│  │  1. Client sends query request                                 │   │
│  │  2. Convex processes query on server                           │   │
│  │  3. Database returns results                                   │   │
│  │  4. Results sent to client                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MUTATION FLOW                                │   │
│  │  1. Client sends mutation request                              │   │
│  │  2. Convex validates and processes mutation                    │   │
│  │  3. Database updates data                                      │   │
│  │  4. Subscribers receive updates in realtime                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle | Complexité | Lines |
|---------|------|------------|-------|
| `convex/schema.ts` | Schema de la base de données | ⭐⭐⭐⭐⭐ | 500+ |
| `convex/sessions.ts` | Queries/Mutations des sessions | ⭐⭐⭐⭐⭐ | 300+ |
| `convex/messages.ts` | Queries/Mutations des messages | ⭐⭐⭐⭐ | 200+ |
| `convex/_generated/` | Code généré par Convex | ⭐⭐⭐ | N/A |

---

## 🏗️ CONVEX ARCHITECTURE

### Concepts de Base

**Convex** est une plateforme **Backend-as-a-Service** qui fournit:

1. **Database**: Base de données NoSQL avec queries et mutations
2. **Realtime**: Subscriptions WebSocket pour les mises à jour en temps réel
3. **Authentication**: Gestion des utilisateurs et permissions
4. **File Storage**: Stockage de fichiers
5. **Functions**: Fonctions serverless

### Intégration dans Vibra

Vibra utilise Convex pour:
- ✅ Stocker les sessions et messages
- ✅ Gérer les utilisateurs et authentification
- ✅ Synchroniser l'état en temps réel
- ✅ Exécuter des queries et mutations
- ✅ Gérer les subscriptions
- ✅ Stocker les coûts et usage

### Avantages de Convex

| Avantages | Description |
|-----------|-------------|
| Realtime | Mises à jour instantanées via WebSocket |
| Type-Safe | Schema TypeScript avec validation |
| Scalable | Architecture serverless scalable |
| Offline | Support du cache local et synchronisation |
| Simple | API simple et intuitive |
| Secure | Vérification des permissions intégrée |

---

## 📋 DATABASE SCHEMA

### Schema Complet

**Source**: `vibracode-backend/convex/schema.ts`

```typescript
export default defineSchema({
  // Utilisateurs
  users: defineTable({
    clerkId: v.optional(v.string()),
    // Profile
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Subscription & Billing
    subscriptionPlan: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    // Stripe
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    // Billing
    accessExpiresAt: v.optional(v.number()),
    billingPeriodEnd: v.optional(v.number()),
    isCanceled: v.optional(v.boolean()),
    cancellationDate: v.optional(v.number()),
    isTrialPeriod: v.optional(v.boolean()),
    willRenew: v.optional(v.boolean()),
    originalProductId: v.optional(v.string()),
    lastGrantedTransactionId: v.optional(v.string()),
    // Message System (Token Mode)
    messagesRemaining: v.optional(v.number()),
    messagesUsed: v.optional(v.number()),
    lastMessageReset: v.optional(v.number()),
    // Agent Type & Billing Mode
    agentType: v.optional(v.union(v.literal('cursor'), v.literal('claude'), v.literal('gemini'))),
    billingMode: v.optional(v.union(v.literal('tokens'), v.literal('credits'))),
    // Credit System (Claude)
    creditsUSD: v.optional(v.number()),
    creditsUsed: v.optional(v.number()),
    totalPaidUSD: v.optional(v.number()),
    realCostUSD: v.optional(v.number()),
    profitUSD: v.optional(v.number()),
    lastCostUpdate: v.optional(v.number()),
    lastPaymentDate: v.optional(v.number()),
    // Mobile App
    notificationsEnabled: v.optional(v.boolean()),
    pushToken: v.optional(v.string()),
  })
    .index('by_clerkId', ['clerkId'])
    .index('by_subscriptionPlan', ['subscriptionPlan'])
    .index('by_messagesRemaining', ['messagesRemaining'])
    .index('by_lastMessageReset', ['lastMessageReset'])
    .index('by_agentType', ['agentType']),

  // Sessions
  sessions: defineTable({
    createdBy: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    name: v.string(),
    tunnelUrl: v.optional(v.string()),
    repository: v.optional(v.string()),
    templateId: v.string(),
    pullRequest: v.optional(v.any()),
    githubRepository: v.optional(v.string()),
    githubRepositoryUrl: v.optional(v.string()),
    githubPushStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('failed')
      )
    ),
    githubPushDate: v.optional(v.number()),
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
    agentStopped: v.optional(v.boolean()),
    totalCostUSD: v.optional(v.number()),
    messageCount: v.optional(v.number()),
    lastCostUpdate: v.optional(v.number()),
    envs: v.optional(v.record(v.string(), v.string())),
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

  // Messages
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

  // Costs
  costs: defineTable({
    sessionId: v.id('sessions'),
    timestamp: v.number(),
    costUSD: v.number(),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    messagesUsed: v.optional(v.number()),
    operation: v.string(),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_timestamp', ['timestamp']),

  // Files
  files: defineTable({
    sessionId: v.id('sessions'),
    name: v.string(),
    path: v.string(),
    content: v.string(),
    size: v.number(),
    mimeType: v.optional(v.string()),
    uploadedAt: v.number(),
    userId: v.string(),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_userId', ['userId']),

  // Images
  images: defineTable({
    sessionId: v.id('sessions'),
    url: v.string(),
    prompt: v.optional(v.string()),
    generatedAt: v.number(),
    userId: v.string(),
    size: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_userId', ['userId']),

  // Videos
  videos: defineTable({
    sessionId: v.id('sessions'),
    url: v.string(),
    prompt: v.optional(v.string()),
    generatedAt: v.number(),
    userId: v.string(),
    duration: v.optional(v.number()),
    size: v.optional(v.number()),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_userId', ['userId']),
});
```

### Indexes

Les **indexes** permettent des requêtes optimisées:

| Table | Index | Utilisation |
|-------|-------|-------------|
| users | by_clerkId | Récupérer un utilisateur par Clerk ID |
| users | by_subscriptionPlan | Filtrer par plan de subscription |
| sessions | by_createdBy | Lister les sessions d'un utilisateur |
| sessions | by_status | Filtrer par statut |
| sessions | by_totalCostUSD | Trier par coût |
| sessions | by_templateId | Filtrer par template |
| messages | by_session | Récupérer les messages d'une session |
| costs | by_sessionId | Récupérer les coûts d'une session |
| files | by_sessionId | Récupérer les fichiers d'une session |
| files | by_userId | Récupérer les fichiers d'un utilisateur |

---

## 🔄 QUERIES & MUTATIONS

### Sessions Queries

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

    const limit = Math.min(args.limit || 100, 500);

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_createdBy', (q) => q.eq('createdBy', args.createdBy))
      .order('desc')
      .take(limit);

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

### Sessions Mutations

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

### Messages Queries

**Source**: `convex/messages.ts`

```typescript
// Liste des messages d'une session
export const listBySession = query({
  args: {
    sessionId: v.id('sessions'),
    createdBy: v.string(), // Vérification de propriété
  },
  handler: async (ctx, args) => {
    // Vérification de propriété de la session
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.createdBy !== args.createdBy) {
      return [];
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .order('asc')
      .collect();

    return messages.map((msg) => ({
      ...msg,
      id: msg._id,
    }));
  },
});

// Récupère un message spécifique
export const getById = query({
  args: {
    id: v.id('messages'),
    sessionId: v.id('sessions'),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    if (!message) return null;

    // Vérification de propriété
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.createdBy !== args.createdBy) {
      return null;
    }

    return {
      ...message,
      id: message._id,
    };
  },
});
```

### Messages Mutations

```typescript
// Ajout d'un message
export const add = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // Vérification de propriété
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.createdBy !== (await ctx.auth.getUserIdentity())?.tokenIdentifier) {
      throw new Error('Unauthorized');
    }

    // Ajout du message
    const messageId = await ctx.db.insert('messages', {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      edits: args.edits,
      todos: args.todos,
      toolCalls: args.toolCalls,
    });

    // Mise à jour du message count de la session
    await ctx.db.patch(args.sessionId, {
      messageCount: (session.messageCount || 0) + 1,
    });

    return messageId;
  },
});

// Suppression d'un message
export const remove = mutation({
  args: {
    id: v.id('messages'),
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    if (!message) {
      throw new Error('Message not found');
    }

    // Vérification de propriété
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.createdBy !== (await ctx.auth.getUserIdentity())?.tokenIdentifier) {
      throw new Error('Unauthorized');
    }

    // Suppression du message
    await ctx.db.delete(args.id);

    // Mise à jour du message count de la session
    await ctx.db.patch(args.sessionId, {
      messageCount: Math.max(0, (session.messageCount || 0) - 1),
    });
  },
});
```

---

## 🔄 SUBSCRIPTIONS

### Mécanisme des Subscriptions

Convex fournit un système de **subscriptions** basé sur WebSocket:

1. **Le client s'abonne** à une query
2. **Convex établit** une connexion WebSocket
3. **Les changements** dans la base de données déclenchent des mises à jour
4. **Les mises à jour** sont streamées vers le client
5. **Le client reçoit** les nouvelles données en temps réel

### Exemple de Subscription

**Client (React)**:
```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function SessionList() {
  const sessions = useQuery(api.sessions.list, { createdBy: userId });
  
  // Les sessions sont automatiquement mises à jour en temps réel
  return (
    <div>
      {sessions?.map(session => (
        <SessionItem key={session.id} session={session} />
      ))}
    </div>
  );
}
```

**Client (Next.js)**:
```typescript
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function SessionPage({ sessionId }: { sessionId: string }) {
  const session = useQuery(api.sessions.getById, {
    id: sessionId as Id<'sessions'>,
    createdBy: userId,
  });
  
  const messages = useQuery(api.messages.listBySession, {
    sessionId: sessionId as Id<'sessions'>,
    createdBy: userId,
  });
  
  // La session et les messages sont automatiquement mis à jour
  return (
    <div>
      <SessionHeader session={session} />
      <MessageList messages={messages} />
    </div>
  );
}
```

### Subscription Custom

Pour des subscriptions plus avancées:

```typescript
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

function ChatInput({ sessionId }: { sessionId: string }) {
  const addMessage = useMutation(api.messages.add);
  const messages = useQuery(api.messages.listBySession, {
    sessionId: sessionId as Id<'sessions'>,
    createdBy: userId,
  });
  
  const handleSend = async (content: string) => {
    await addMessage({
      sessionId: sessionId as Id<'sessions'>,
      role: 'user',
      content,
    });
    // Le nouveau message apparaîtra automatiquement dans la liste
  };
  
  return (
    <div>
      <MessageList messages={messages} />
      <input onSend={handleSend} />
    </div>
  );
}
```

---

## 🔄 REALTIME FLOW

### Flow Complet

```
CLIENT
  │
  ▼
┌─────────────────────┐
│  useQuery() /        │  (Subscription à une query)
│  useMutation()       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Convex Client       │  (convex/react ou convex/nextjs)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  WebSocket           │  (Connexion WebSocket à Convex)
│  Connection          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Convex Server       │  (Gère les subscriptions)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Database            │  (Convex Database)
│  Query              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Initial Data        │  (Données initiales envoyées au client)
└──────────┬──────────┘
           │
           ▼
CLIENT
  │
  ▼
┌─────────────────────┐
│  Render Initial      │  (Affichage des données initiales)
│  Data               │
└──────────┬──────────┘
           │
           ▼ (changement dans la DB)
┌─────────────────────┐
│  Database Change     │  (Nouveau message, mise à jour de session)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Convex Server       │  (Détecte le changement)
│  Detects Change      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  WebSocket           │  (Envoie la mise à jour au client)
│  Update              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Client Receives     │  (Réception de la mise à jour)
│  Update              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  React Re-renders    │  (Re-rendu avec les nouvelles données)
└─────────────────────┘
```

### Exemple avec Messages

```
USER
  │
  ▼
Envoie un message "Bonjour"
  │
  ▼
┌─────────────────────┐
│  addMessage()        │  (Mutation Convex)
│  mutation           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Database            │  (Nouveau message ajouté)
│  Insert             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Subscribers         │  (Tous les clients abonnés à cette session)
│  Notified           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Client UI           │  (Nouveau message apparaît instantanément)
│  Update              │
└─────────────────────┘
```

---

## 🔄 STATE SYNCHRONIZATION

### Synchronisation des Sessions

```typescript
// Dans run-agent.ts
const updateSessionStatus = async (
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
    
    // Tous les clients abonnés à cette session reçoivent la mise à jour
  } catch (error) {
    console.warn('⚠️ Non-fatal: Failed to update session status:', error);
  }
};
```

### Synchronisation des Messages

```typescript
// Dans run-agent.ts
const addMessage = async (
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

    // Tous les clients abonnés aux messages de cette session reçoivent le nouveau message
    return messageId;
  } catch (error) {
    console.warn('⚠️ Non-fatal: Failed to add message:', error);
    return null;
  }
};
```

### Synchronisation du Streaming

```typescript
// Dans run-agent.ts (processStdoutLine)
const processStdoutLine = async (parsedData: any, eventTimestamp: number) => {
  // ... parsing
  
  // Ajout du message à la DB
  const messageId = await addMessage(id, content, "assistant", eventTimestamp);
  
  // Le message est immédiatement synchronisé avec tous les clients
  // grâce aux subscriptions Convex
};
```

---

## 💾 OFFLINE SUPPORT

### Cache Local

Convex supporte le **cache local** pour les applications mobiles:

1. **Cache des queries**: Les résultats des queries sont cachés localement
2. **Synchronisation automatique**: Les changements sont synchronisés lors de la reconnexion
3. **Optimistic Updates**: Les mutations peuvent être appliquées localement avant la confirmation du serveur

### Exemple avec Cache

```typescript
// Configuration du cache
import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  // Configuration du cache
  unsavedChangesWarning: false,
  // Autres options...
});

function App() {
  return (
    <ConvexProvider client={convex}>
      <AppContent />
    </ConvexProvider>
  );
}
```

### Comportement Hors Ligne

1. **Lecture**: Les données sont lues depuis le cache local
2. **Écriture**: Les mutations sont stockées localement et synchronisées plus tard
3. **Reconnexion**: Les données locales sont synchronisées avec le serveur
4. **Conflits**: Convex gère les conflits automatiquement

---

## 🚨 ERROR HANDLING

### Gestion des Erreurs dans les Queries

```typescript
// Dans les queries Convex
if (!args.createdBy) {
  console.warn('sessions.list called without createdBy - returning empty array for security');
  return []; // Retourne un tableau vide au lieu d'une erreur
}
```

### Gestion des Erreurs dans les Mutations

```typescript
// Vérification de propriété dans les mutations
const session = await ctx.db.get(args.id);
if (!session) {
  throw new Error('Session not found');
}
if (session.createdBy !== (await ctx.auth.getUserIdentity())?.tokenIdentifier) {
  throw new Error('Unauthorized');
}
```

### Gestion des Erreurs dans les Subscriptions

```typescript
// Dans le client
const sessions = useQuery(api.sessions.list, { createdBy: userId });

if (sessions === undefined) {
  // Chargement
  return <Loading />;
}

if (sessions === null) {
  // Erreur
  return <Error message="Failed to load sessions" />;
}

// Succès
return <SessionList sessions={sessions} />;
```

---

## 🔄 COMPARISON AVEC SORYOS

### Similarités

| Feature | Vibra | SoryOS | Match |
|---------|-------|--------|-------|
| Realtime Updates | ✅ (Convex) | ⭐ | ⭐ |
| Database | ✅ (Convex) | ✅ | ⭐⭐⭐ |
| Queries | ✅ | ✅ | ⭐⭐⭐⭐ |
| Mutations | ✅ | ✅ | ⭐⭐⭐⭐ |
| Subscriptions | ✅ | ⭐ | ⭐ |
| Offline Support | ✅ | ⭐ | ⭐ |
| Type Safety | ✅ | ✅ | ⭐⭐⭐⭐ |

### Différences

| Feature | Vibra | SoryOS | Action |
|---------|-------|--------|--------|
| Realtime System | Convex Subscriptions | À implémenter | **Adapter** |
| Database | Convex | À définir | **Adapter** |
| Schema | Très complet | À définir | **Adapter** |
| Subscriptions | WebSocket natif | À implémenter | **Implémenter** |
| Offline Support | Natif Convex | À adapter | **Adapter** |

### Avantages Vibra à Extraire

1. **Convex Architecture**: Architecture complète avec queries, mutations, subscriptions
2. **Realtime Subscriptions**: Mises à jour instantanées via WebSocket
3. **Type Safety**: Schema TypeScript avec validation
4. **Offline Support**: Cache local et synchronisation automatique
5. **Error Handling**: Gestion robuste des erreurs
6. **Ownership Verification**: Vérification systématique des permissions

### Points à Améliorer dans SoryOS

1. **Realtime System**: Doit supporter les subscriptions WebSocket
2. **Database Schema**: Doit être aussi complet que Vibra
3. **Type Safety**: Doit avoir une validation des types
4. **Offline Support**: Doit supporter le cache local

---

## 🎯 RECOMMANDATIONS

### Pour SoryOS-Code

#### 1. Realtime Manager (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/realtime/src/manager.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc, broadcast};
use futures::Stream;

#[derive(Debug, Clone)]
pub struct RealtimeManager {
    // Canal pour les mises à jour
    update_sender: Arc<broadcast::Sender<RealtimeUpdate>>,
    // Subscriptions actives
    subscriptions: Arc<RwLock<HashMap<String, Vec<mpsc::Sender<RealtimeUpdate>>>>>,
    // Client de base de données
    db_client: Arc<dyn DatabaseClient>,
}

#[derive(Debug, Clone)]
pub enum RealtimeUpdate {
    SessionCreated(Session),
    SessionUpdated(Session),
    SessionDeleted(String),
    MessageAdded(Message),
    MessageUpdated(Message),
    MessageDeleted(String),
    // ... autres types d'updates
}

impl RealtimeManager {
    pub fn new(db_client: Arc<dyn DatabaseClient>) -> Self {
        let (update_sender, _) = broadcast::channel(1000);
        Self {
            update_sender: Arc::new(update_sender),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            db_client,
        }
    }
    
    pub fn subscribe(&self, session_id: &str) -> impl Stream<Item = RealtimeUpdate> {
        let mut subscriptions = self.subscriptions.write().blocking_lock();
        let (tx, rx) = mpsc::channel(100);
        
        subscriptions.entry(session_id.to_string())
            .or_insert_with(Vec::new)
            .push(tx);
        
        // Créer un stream qui fusionne les updates globales et les updates de session
        let global_rx = self.update_sender.subscribe();
        
        futures::stream::select(
            futures::stream::iter(vec![rx]),
            global_rx.into_stream(),
        )
        .filter(move |update| {
            match update {
                RealtimeUpdate::SessionUpdated(s) => s.id == session_id,
                RealtimeUpdate::SessionDeleted(id) => id == session_id,
                RealtimeUpdate::MessageAdded(m) => m.session_id == session_id,
                RealtimeUpdate::MessageUpdated(m) => m.session_id == session_id,
                RealtimeUpdate::MessageDeleted(id) => {
                    // Vérifier si le message appartient à la session
                    true // Simplification
                }
                _ => true,
            }
        })
    }
    
    pub async fn publish_update(&self, update: RealtimeUpdate) -> Result<(), RealtimeError> {
        self.update_sender.send(update.clone()).map_err(|e| {
            RealtimeError::BroadcastError(e.to_string())
        })?;
        
        // Publier vers les subscriptions spécifiques
        match &update {
            RealtimeUpdate::SessionUpdated(s) => {
                self.publish_to_session(&s.id, update).await?;
            }
            RealtimeUpdate::SessionDeleted(id) => {
                self.publish_to_session(id, update).await?;
            }
            RealtimeUpdate::MessageAdded(m) => {
                self.publish_to_session(&m.session_id, update).await?;
            }
            RealtimeUpdate::MessageUpdated(m) => {
                self.publish_to_session(&m.session_id, update).await?;
            }
            _ => {}
        }
        
        Ok(())
    }
    
    async fn publish_to_session(&self, session_id: &str, update: RealtimeUpdate) -> Result<(), RealtimeError> {
        let subscriptions = self.subscriptions.read().await;
        if let Some(senders) = subscriptions.get(session_id) {
            for sender in senders {
                if sender.send(update.clone()).await.is_err() {
                    // Canal fermé, nettoyer
                    let mut mut_subscriptions = self.subscriptions.write().await;
                    if let Some(senders) = mut_subscriptions.get_mut(session_id) {
                        senders.retain(|s| !s.is_closed());
                    }
                }
            }
        }
        Ok(())
    }
    
    pub async fn start_listening(&self) -> Result<(), RealtimeError> {
        // Écouter les changements de la base de données
        let mut db_stream = self.db_client.listen_for_changes().await?;
        
        while let Some(change) = db_stream.next().await {
            let update = match change {
                DatabaseChange::SessionCreated(s) => RealtimeUpdate::SessionCreated(s),
                DatabaseChange::SessionUpdated(s) => RealtimeUpdate::SessionUpdated(s),
                DatabaseChange::SessionDeleted(id) => RealtimeUpdate::SessionDeleted(id),
                DatabaseChange::MessageAdded(m) => RealtimeUpdate::MessageAdded(m),
                DatabaseChange::MessageUpdated(m) => RealtimeUpdate::MessageUpdated(m),
                DatabaseChange::MessageDeleted(id) => RealtimeUpdate::MessageDeleted(id),
            };
            
            self.publish_update(update).await?;
        }
        
        Ok(())
    }
}
```

#### 2. Subscription Manager (⭐⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/realtime/src/subscriptions.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct SubscriptionManager {
    realtime_manager: Arc<RealtimeManager>,
    active_subscriptions: Arc<RwLock<HashMap<String, Arc<dyn Subscription>>>>,
}

#[async_trait]
pub trait Subscription: Send + Sync {
    async fn next(&mut self) -> Option<RealtimeUpdate>;
    fn id(&self) -> &str;
    fn close(&mut self);
}

impl SubscriptionManager {
    pub fn new(realtime_manager: Arc<RealtimeManager>) -> Self {
        Self {
            realtime_manager,
            active_subscriptions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn subscribe_to_session(&self, session_id: &str) -> Result<impl Subscription, RealtimeError> {
        let subscription_id = uuid::Uuid::new_v4().to_string();
        
        let stream = self.realtime_manager.subscribe(session_id);
        let (tx, rx) = mpsc::channel(100);
        
        // Forward le stream vers le canal
        tokio::spawn(async move {
            let mut stream = stream;
            while let Some(update) = stream.next().await {
                if tx.send(update).await.is_err() {
                    break;
                }
            }
        });
        
        let subscription = SessionSubscription {
            id: subscription_id.clone(),
            receiver: rx,
        };
        
        self.active_subscriptions.write().await
            .insert(subscription_id, Arc::new(subscription.clone()));
        
        Ok(subscription)
    }
    
    pub async fn unsubscribe(&self, subscription_id: &str) -> Result<(), RealtimeError> {
        self.active_subscriptions.write().await.remove(subscription_id);
        Ok(())
    }
    
    pub async fn cleanup(&self) -> Result<(), RealtimeError> {
        let mut subscriptions = self.active_subscriptions.write().await;
        for (id, subscription) in subscriptions.iter_mut() {
            subscription.close();
        }
        subscriptions.clear();
        Ok(())
    }
}

#[derive(Debug, Clone)]
struct SessionSubscription {
    id: String,
    receiver: mpsc::Receiver<RealtimeUpdate>,
}

#[async_trait]
impl Subscription for SessionSubscription {
    async fn next(&mut self) -> Option<RealtimeUpdate> {
        self.receiver.recv().await
    }
    
    fn id(&self) -> &str {
        &self.id
    }
    
    fn close(&mut self) {
        // Le canal sera fermé automatiquement quand le receiver est droppé
    }
}
```

#### 3. WebSocket Server (⭐⭐⭐⭐)

**À Implémenter**:
```rust
// packages/realtime/src/websocket.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use warp::{Filter, websocket::Message};
use futures::{SinkExt, StreamExt};

#[derive(Debug, Clone)]
pub struct WebSocketManager {
    subscription_manager: Arc<SubscriptionManager>,
    connections: Arc<RwLock<HashMap<String, mpsc::Sender<Result<Message, warp::Error>>>>>,
}

impl WebSocketManager {
    pub fn new(subscription_manager: Arc<SubscriptionManager>) -> Self {
        Self {
            subscription_manager,
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn handle_connection(
        &self,
        session_id: String,
        ws: warp::websocket::WebSocket,
    ) -> Result<(), RealtimeError> {
        let (mut ws_sender, mut ws_receiver) = ws.split();
        
        // Créer une subscription
        let mut subscription = self.subscription_manager.subscribe_to_session(&session_id).await?;
        
        // Canal pour envoyer les messages au client
        let (tx, mut rx) = mpsc::channel(100);
        
        // Stocker la connexion
        self.connections.write().await.insert(session_id.clone(), tx);
        
        // Task pour forwarder les updates vers le WebSocket
        let forward_task = tokio::spawn(async move {
            while let Some(update) = subscription.next().await {
                let message = match update {
                    RealtimeUpdate::SessionCreated(s) => {
                        Message::text(serde_json::to_string(&WebSocketMessage::SessionCreated(s)).unwrap())
                    }
                    RealtimeUpdate::SessionUpdated(s) => {
                        Message::text(serde_json::to_string(&WebSocketMessage::SessionUpdated(s)).unwrap())
                    }
                    RealtimeUpdate::MessageAdded(m) => {
                        Message::text(serde_json::to_string(&WebSocketMessage::MessageAdded(m)).unwrap())
                    }
                    // ... autres variants
                };
                
                if ws_sender.send(message).await.is_err() {
                    break;
                }
            }
        });
        
        // Task pour recevoir les messages du client
        let receive_task = tokio::spawn(async move {
            while let Some(result) = ws_receiver.next().await {
                match result {
                    Ok(msg) => {
                        // Traiter le message du client
                        if let Ok(text) = msg.to_str() {
                            // Parser le message JSON
                            if let Ok(client_msg) = serde_json::from_str::<WebSocketClientMessage>(text) {
                                // Traiter la requête du client
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("WebSocket error: {}", e);
                        break;
                    }
                }
            }
        });
        
        // Attendre que l'une des tâches se termine
        tokio::select! {
            _ = forward_task => {}
            _ = receive_task => {}
        }
        
        // Nettoyer
        self.connections.write().await.remove(&session_id);
        subscription.close();
        
        Ok(())
    }
    
    pub fn create_websocket_route(&self) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
        let manager = self.clone();
        
        warp::path("realtime")
            .and(warp::ws())
            .and(warp::path::param::<String>())
            .and_then(move |session_id: String, ws: warp::websocket::WebSocket| {
                let manager = manager.clone();
                async move {
                    manager.handle_connection(session_id, ws).await
                        .map_err(|e| warp::reject::custom(e))?;
                    Ok(warp::reply::reply())
                }
            })
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum WebSocketMessage {
    SessionCreated(Session),
    SessionUpdated(Session),
    SessionDeleted(String),
    MessageAdded(Message),
    MessageUpdated(Message),
    MessageDeleted(String),
    Ping,
    Pong,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum WebSocketClientMessage {
    Subscribe { session_id: String },
    Unsubscribe { session_id: String },
    Ping,
    // ... autres types de messages
}
```

---

## 📅 PROCHAINES ÉTAPES

### Phase 1: Realtime Foundation (Priorité ⭐⭐⭐⭐)

1. **Créer le RealtimeManager**
   - Créer `packages/realtime/src/manager.rs`
   - Implémenter publish_update et subscribe
   - Tester avec des updates mock

2. **Créer le SubscriptionManager**
   - Créer `packages/realtime/src/subscriptions.rs`
   - Implémenter subscribe_to_session et unsubscribe
   - Tester avec des subscriptions mock

3. **Intégrer avec la base de données**
   - Écouter les changements de la DB
   - Publier les updates vers le RealtimeManager

### Phase 2: WebSocket Implementation (Priorité ⭐⭐⭐⭐)

4. **Créer le WebSocketManager**
   - Créer `packages/realtime/src/websocket.rs`
   - Implémenter handle_connection
   - Tester avec des connexions WebSocket réelles

5. **Ajouter les routes WebSocket**
   - Intégrer avec le serveur HTTP
   - Tester les connexions

### Phase 3: Client Integration (Priorité ⭐⭐⭐)

6. **Créer le client WebSocket**
   - Créer `packages/realtime/src/client.rs`
   - Implémenter la connexion et la réception des messages
   - Tester avec le serveur

7. **Intégrer avec l'UI**
   - Utiliser le client dans l'interface web
   - Tester les mises à jour en temps réel

---

## 📚 RÉFÉRENCES

- [Convex Documentation](https://docs.convex.dev)
- [Convex Subscriptions](https://docs.convex.dev/database/subscriptions)
- [Convex Queries](https://docs.convex.dev/database/queries)
- [Convex Mutations](https://docs.convex.dev/database/mutations)
- [Convex Schema](https://docs.convex.dev/database/schema)
- [Vibra Code Convex Schema](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/convex/schema.ts)
- [Vibra Code Convex Sessions](https://github.com/sa4hnd/vibra-code/blob/main/vibracode-backend/convex/sessions.ts)

---

**Auteur**: SoryOS Team  
**Date**: 2025-10-08  
**Version**: 1.0  
**Statut**: Analyse Complète
