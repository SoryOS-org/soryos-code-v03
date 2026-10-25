# Plan — Shared CLI / GUI Interface Layer

> **Goal**: the terminal CLI and the web GUI must drive the **same engine** and render the
> **same events**, without duplicating logic in either adapter.
>
> **Status**: ✅ **ALL PHASES DONE** — Phase 0 (CLI v2) · Phase 1 (`runPipeline`) · Phase 2 (shared session resolution) · Phase 3 (canonical events) · Phase 4 (parity harness + CI guard).

---

## 0. Context: what exists today

```
apps/web (Next.js)                        packages/cli (Node/tsx)
  ├─ POST /api/sessions/:id/run    ─┐      ├─ src/index.ts
  ├─ POST /api/sessions/:id/messages ─┤   ├─ src/framework/{spec,ui,flags,render,engine,interactive}.ts
  │   → runPipeline()                │   ├─ src/cli-session-store.ts
  │   → SSE route writes events      │   └─ src/commands/*
  └───────────────────────────────┘        │
              │                             │
              └──────────────┬──────────────┘
                             ▼
              @soryos/agent  →  @soryos/tool  →  @soryos/execution
                             ▼
                       @soryos/bus  (globalEventBus)
```

Both sides call the **same** `runPipeline()` from `@soryos/agent`. The duplication today is
**not** in the engine — it is in the *adapters*:

| Concern | Web (`apps/web`) | CLI (`packages/cli`) | Should be shared? |
|---|---|---|---|
| Run invocation | route handler calls `runPipeline()` | `framework/engine.ts` calls `runPipeline()` | ✅ **done** |
| Session resolution | `resolveSessionTarget` (memory source) | `framework/session.ts` (disk source) | ✅ done |
| Event → UI mapping | SSE route writes canonical events | `framework/render.ts` (canonical renderer) | ✅ done |
| Permission answers | `POST /api/sessions/:id/permissions` | `framework/interactions.ts` (`--auto` ⇒ allow, else deny) | ✅ done |
| Question answers | `POST /api/sessions/:id/questions` | `framework/interactions.ts` (cancelled with feedback) | ✅ done |
| Rendering | React components | ANSI text | NO (presentation) |
| Transport | HTTP + SSE | stdout/stderr | NO (transport) |

---

## Phase 1 — Extract the run pipeline into `@soryos/agent` ✅ DONE

**Objective**: one function owns "prepare session → attach user message → run → persist".

### 1.1 New module `packages/agent/src/run-pipeline.ts`

```ts
export interface RunPipelineOptions {
  sessionId: string;
  /** Requête utilisateur (ajoutée à la session si fournie). */
  prompt?: string;
  /** Pièces jointes (vision) attachées au message utilisateur. */
  images?: ChatImageAttachment[];
  agentId?: string;
  modelId?: string;
  apiKey?: string;
}

export type RunPipelineResult =
  | { status: "completed"; session: SessionData }
  | { status: "failed"; session: SessionData | null; error: string };

export async function runPipeline(
  options: RunPipelineOptions,
  emit: (event: { type: string; [key: string]: any }) => void,
): Promise<RunPipelineResult>;
```

Responsibilities (moved **verbatim** from the adapters, not rewritten):
- validate prompt / credentials (honest errors)
- load the session from the store, append the user message
- ensure a workspace exists for the session (local ⇒ `process.cwd()`)
- call `agentRuntime.run({ sessionId, modelId, agentId, apiKey, emit })`
- catch failures → `status: "failed"` with the real error message
- return the updated session (caller decides where to persist it)

> `AgentRuntime.run()` now returns `'completed' | 'failed' | 'paused'` (it used to return
> `void`), so a planner failure that does **not** throw is honestly reported as
> `status: "failed"` instead of a false success.

### 1.2 Adapt the web route

`apps/web/app/api/sessions/[id]/messages/route.ts` and `.../run/route.ts` now call
`runPipeline()` and only write the SSE transport.

### 1.3 Adapt the CLI

`packages/cli/src/framework/engine.ts#executeRun` is the **single** CLI call site of
`runPipeline()`. It is used by both `commands/run.ts` (non-interactive) and
`framework/interactive.ts` (REPL), so the terminal modes cannot drift apart.

### Acceptance criteria
- [x] `npm run typecheck` → 0 errors
- [x] `npm run test:engine` → all green
- [x] `soryos-code run "x"` produces the same event sequence as before the refactor
- [x] the web `/run` route still streams `status/text/tool_start/tool_end/done/error`
- [x] **no** duplicated run logic left in `apps/web` or `packages/cli`

---

## Phase 2 — Shared session resolution ✅ DONE

**Objective**: `--session` / `--continue` / `--fork` behave identically in CLI and GUI.

### 2.1 New module `packages/session/src/target.ts`

```ts
export interface SessionSource {
  get(id: string): Promise<SessionData | null>;
  list(): Promise<SessionData[]>;
  create(data: Partial<SessionData>): SessionData;
  /** Persistance AWAITÉE (les stores disque l'implémentent). */
  persist?(session: SessionData): Promise<void>;
}

export type SessionTarget =
  | { kind: "new"; id: string }
  | { kind: "resume"; id: string }
  | { kind: "fork"; sourceId: string; id: string };

export async function resolveSessionTarget(
  opts: { sessionId?: string; continueLast?: boolean; fork?: boolean; title?: string; cwd?: string; template?: Partial<SessionData> },
  source: SessionSource,
): Promise<{ target: SessionTarget; session: SessionData }>;
```

Rules (ported from opencode `session-target.ts`, adapted to our stores):
- `--fork` without `--session`/`--continue` → honest error
- `--session <id>` on a missing session → **that id becomes the new session's id**
- `--continue` → most recent session (filtered by `cwd` when provided)
- `--fork` → copy of the source session with a new id and the same message history

Two implementations are provided:
- `memorySessionSource` (in `@soryos/session`) — the in-memory store
- `cliSessionSource` (in `packages/cli`) — the disk store (`.soryos/cli-sessions/`)

### 2.2 Use it in both adapters
- CLI: `framework/session.ts#resolveCliSession` (used by `run` AND `interactive` — the
  duplicated local `resolveSession()` implementations were deleted)
- Web: `POST /api/sessions/[id]/run` accepts `{ target: "continue" | "fork" }` and resolves
  through the same `resolveSessionTarget` with `memorySessionSource`

### Acceptance criteria
- [x] `soryos-code run "x" -c` resumes the newest session
- [x] `soryos-code run "x" --fork` creates a copy with a new id
- [x] the GUI can trigger the same three modes (`target` field)
- [x] both adapters share **one** implementation (no copy)
- [x] 15 unit tests in `packages/session/__tests__/target.test.ts`

---

## Phase 3 — Canonical event contract + renderer ✅ DONE

**Objective**: one canonical event shape, two renderers.

### 3.1 Canonical event contract (`packages/schema/src/events.ts`)

```ts
export type SoryOSEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_end"; id: string; output: string; isError: boolean }
  | { type: "permission_requested"; requestId: string; toolName: string }
  | { type: "question_asked"; requestId: string; questions: unknown[] }
  | { type: "file_changed"; path: string; action: string }
  | { type: "preview"; url: string }
  | { type: "error"; message: string }
  | { type: "done"; usage?: { input: number; output: number } };
```

`toSoryOSEvent(raw)` translates **both** vocabularies (the planner stream and the
bus) into this single shape. The bus tool events (`tool.started/completed/failed`)
are deliberately dropped: they duplicate the plan's `tool_use`/`tool_end`.

`runPipeline()` (in `@soryos/agent`) now emits **canonical events only**: it
subscribes to the bus, filters by session, and forwards everything through
`toSoryOSEvent()`. Adapters never see a raw event any more.

> The planner's own `done` means "this LLM turn is over", not "the run is over":
> it is NOT translated, the canonical `done` is reserved for the bus
> `agent.completed`.

### 3.2 Two renderers over the same contract
- **CLI renderer** (`packages/cli/src/framework/render.ts`): canonical events → ANSI on
  stderr, NDJSON on stdout
- **GUI renderer** (`apps/web/app/chat/[id]/page.tsx`): canonical events → React chat blocks
  (`tool_use` replaces the old `tool_start`, `file_changed` replaces `files_changed`)

### 3.3 Questions & permissions parity
`packages/cli/src/framework/interactions.ts` handles the canonical requests:
- `permission_requested` → `--auto` allows, otherwise denies with feedback (never hangs)
- `question_asked` → cancelled with an honest feedback (never hangs)

The GUI keeps its existing interactive routes.

### Acceptance criteria
- [x] `--format json` NDJSON events match the canonical contract exactly
- [x] the GUI's chat blocks are produced by the shared translator
- [x] a question asked during a CLI run is cancelled honestly (never hangs)
- [x] 17 unit tests in `packages/schema/__tests__/events.test.ts`

---

## Phase 4 — One core, two front-ends (the "same heart" guarantee) ✅ DONE

**Objective**: a single source of truth for *what runs*, with adapters that only render.

### 4.1 Rule
> The engine decides **what** happens. The adapter decides only **how it is displayed**.

Concretely:
- `@soryos/agent` = the only place that orchestrates a run (`runPipeline`)
- `@soryos/session` = the only place that stores/loads sessions (`resolveSessionTarget`)
- `@soryos/schema` = the only event vocabulary (`SoryOSEvent` + `toSoryOSEvent`)
- `@soryos/tool` + `@soryos/permissions` = the only place that executes actions
- `apps/web` and `packages/cli` = **adapters** (transport + rendering only)

### 4.2 Verification harness (`packages/agent/__tests__/parity.test.ts`)
1. a deterministic fake LLM (no network) drives the planner
2. `createRunPipeline(runtime)` allows injecting that runtime
3. the emitted canonical events are captured and compared between two consumers
4. the contract test asserts only known canonical types are emitted

### 4.3 CI guard
`packages/agent/__tests__/parity.test.ts` scans `apps/web` and `packages/cli`:
- **no** adapter may call `agentRuntime.run()` directly (it must call `runPipeline()`)
- every adapter must call `runPipeline()`

> Verified: injecting a deliberate `agentRuntime.run()` in `packages/cli` makes the
> guard fail with the offending file listed.

### Acceptance criteria
- [x] `grep -r "agentRuntime.run" apps/web packages/cli` → no adapter call site
- [x] parity test green (5 tests: 3 parity + 2 guard)
- [x] `npm run typecheck` + `npm run test:engine` green
- [x] dead legacy adapters removed (`apps/web/lib/agent-engine.ts`, `apps/web/lib/sse-helper.ts`)

---

## Roadmap (order + effort)

| Phase | Scope | Effort | Depends on |
|---|---|---|---|
| 0 | CLI v2 (declarative tree, `run`/`session`/`models`/`auth`/`debug`/`plugin`, NDJSON, disk sessions) | ✅ done | — |
| 0.5 | CLI interactive REPL (`interactive`/`i`/`chat`: prompt, history, slash commands) | ✅ done | 0, 1 |
| 1 | `runPipeline` extracted into `@soryos/agent` | ✅ done | — |
| 2 | `resolveSessionTarget` in `@soryos/session` | ✅ done | Phase 1 |
| 3 | Canonical event contract + 2 renderers + questions/permissions parity | ✅ done | Phase 1, 2 |
| 4 | Parity test harness + CI grep guard | ✅ done | Phase 3 |

## Explicit non-goals

- **No TUI framework port** (opencode uses `@opentui` + Solid; we stay text-first).
  The interactive mode is a plain `readline` REPL — no second rendering engine.
- **No Effect** (the Spec tree is hand-rolled, Promise-based — matches the repo style)
- **No daemon / background service** (opencode spawns `opencode serve`; the CLI runs in-process)
- **No remote auth proxy** (opencode stores credentials server-side; we read env vars)

## Risk register

| Risk | Mitigation |
|---|---|
| Refactor breaks the web SSE contract | Keep the SSE event names stable; add a route-level test before switching |
| Two session stores (web in-memory, CLI on disk) drift | Phase 2 makes the target resolution shared; a later phase can back the web store with the same JSON store |
| CLI grows a private fork of the engine | Phase 4 grep guard fails the build |
