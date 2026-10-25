# `@soryos/session` Agent Operating Guidelines

## Overview
This package manages session persistence, chat history, and conversation state across Next.js API requests and CLI runs.

## Responsibilities
- Provide `SessionStore` (`sessionStore` global singleton).
- Persist `SessionData` records.
- Retrieve, update, and list active workspace sessions.
- Provide the **shared session target resolution** (`src/target.ts`): which session does
  a request/command target (`--session` / `--continue` / `--fork`)?

## Key Files
- `src/index.ts`: `SessionStore` + `memorySessionSource` (the `SessionSource` adapter of
  the in-memory store) + re-export of `src/target.ts`.
- `src/target.ts`: `resolveSessionTarget()`, `newestSession()`, `defaultSessionId()`,
  the `SessionSource` contract and the `SessionTarget` type.

## Shared Session Resolution (`src/target.ts`)

```ts
const { target, session } = await resolveSessionTarget(
  { sessionId, continueLast, fork, title, cwd, template },
  source, // SessionSource: memorySessionSource | cliSessionSource (disk)
);
```

Rules:
- `--fork` without `--session`/`--continue` → **honest error** (never a phantom fork)
- `--session <id>` on a missing session → **that id becomes the new session's id**
- `--continue` → most recent session (filtered by `cwd` when provided)
- `--fork` → copy of the source with a new id and the **same message history**

The CLI (`packages/cli`) and the web app (`apps/web`) both go through this function —
never re-implement the rules in an adapter.

## Agent Guidelines
- Always use `sessionStore.getOrCreate(sessionId)` to retrieve session data.
- Call `sessionStore.save(session)` whenever session state or messages are modified.
  (`save()` throws if the id is unknown to the store — hence `getOrCreate` first.)
- Prefer `sessionStore.update(id, { field })` over rewriting a whole object: a stale
  local copy would drop the conversation history.
- A `SessionSource.persist()` implementation must be **awaited** — never fire-and-forget
  a write (two concurrent writes on the same file lose the final state).
- `SessionStore` is **in-memory only** (`globalThis.__soryos_sessions_store`): a server
  restart loses every session. Durable persistence is NOT implemented here.

## Testing
- `npx vitest run` in this package (wired into `npm run test:engine` at the root).
- `packages/session/__tests__/target.test.ts` covers the resolution rules.
