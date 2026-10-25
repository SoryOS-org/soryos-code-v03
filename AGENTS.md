# SoryOS-Code Master Agent Operating Instructions (`AGENTS.md`)

> **System Notice for AI Agents**: This is the authoritative operating guide for all AI Agents (`build`, `plan`, `explore`, `code-reviewer`) working on the SoryOS-Code codebase. You MUST read and follow these rules whenever interacting with this repository.

---

## 🎬 1. Core Architecture & Monorepo Conceptual Map

SoryOS-Code is structured around a strict hierarchy:

```
Project
 └── Workspace (ActiveWorkspace source of truth)
      └── Session (SessionData & conversation state)
           └── Environment
                ├── Local (process.cwd() / Machine Locale)
                └── Sandbox
                     ├── E2B
                     ├── Vercel
                     ├── Codespaces
                     └── Cloud Run
```

### End-to-End Execution Pipeline:
```
USER REQUEST
   ↓
SESSION (@soryos/session)
   ↓
AGENT RUNTIME (@soryos/agent)
   ↓
AI PROVIDER (@soryos/provider - Gemini, OpenAI, Mistral, Zen)
   ↓
TOOL CALL (@soryos/tool)
   ↓
PERMISSIONS MANAGER (@soryos/permissions)
   ↓
EXECUTION PROVIDER (@soryos/execution)
   ↓
PHYSICAL DISK / SHELL EXECUTION (Real Action)
   ↓
EVENT STREAM (@soryos/bus)
   ↓
VERIFICATION & FINAL RESPONSE (UI / CLI)
```

---

## ❤️ 2. Inviolable Operational Rules

1. **NO DUPLICATE IMPLEMENTATIONS**:
   - Always search existing packages under `packages/` before writing new logic.
   - Never create parallel or duplicate runtimes, session managers, or tool executors in `apps/web/` or elsewhere.
2. **NO FAKE EXECUTION & NO FAKE SUCCESS**:
   - Never mock, simulate, or hardcode success messages.
   - Every file edit, command execution, or search MUST execute physically via `@soryos/tool` and `@soryos/execution`.
3. **NO UNVERIFIED RESULTS**:
   - Always verify tool outputs and file modifications on disk before declaring a step complete.
   - Run `npm run typecheck` and `npm run test:engine` after major changes.
4. **STRICT PACKAGE BOUNDARIES**:
   - Presentation logic lives in `apps/web/`.
   - Business runtime logic lives in `packages/*`.
   - Never put runtime business logic inside UI React components.

---

## 🗂️ 3. Package Responsibilities

| Package | Path | Primary Responsibility |
| :--- | :--- | :--- |
| **`@soryos/schema`** | `packages/schema` | Domain types, interfaces, contracts (`ActiveWorkspace`, `SessionData`, `ToolStep`) |
| **`@soryos/core`** | `packages/core` | Base error classes (`ExecutionError`, `PermissionDeniedError`) |
| **`@soryos/bus`** | `packages/bus` | Central EventBus streaming agent, tool, and process events |
| **`@soryos/permissions`**| `packages/permissions` | Granular role-based security (`build` = full access, `plan` = read-only) |
| **`@soryos/execution`** | `packages/execution` | Physical command and file execution provider layer (`LocalExecutionProvider`) |
| **`@soryos/tool`** | `packages/tool` | ToolRegistry & ToolExecutor (`read_file`, `write_file`, `edit_file`, `shell_command`) |
| **`@soryos/agent`** | `packages/agent` | Multi-turn AgentRuntime loop and agent matrix |
| **`@soryos/workspace`** | `packages/workspace` | Source of truth for `ActiveWorkspace` state |
| **`@soryos/session`** | `packages/session` | Persistent session store and history manager |
| **`@soryos/provider`** | `packages/provider` | Multi-model AI Provider Registry (Gemini, OpenAI, Mistral, Zen) |
| **`@soryos/filesystem`**| `packages/filesystem` | Filesystem operations adapter over active ExecutionProvider |
| **`@soryos/git`** | `packages/git` | Git tracking, branch management, and commit operations |
| **`@soryos/pty`** | `packages/pty` | Interactive PTY process stream manager |
| **`@soryos/dev-runner`** | `packages/dev-runner` | Development server orchestrator and port detector |
| **`@soryos/cli`** | `packages/cli` | Autonomous CLI engine (`soryos-code`) |
| **`@soryos/sandbox`** | `packages/sandbox` | Sandbox execution environments (E2B, Vercel, Codespaces, Cloud Run) |
| **`@soryos/plugin`** | `packages/plugin` | Promise-based plugin API, loader, storage backend |
| **`@soryos/theme`** | `packages/theme` | OKLCH theme math (schema, expansion, resolution) |
| **`@soryos/images`** | `packages/images` | Real image format/metadata parsing (magic bytes) |
| **`@soryos/vision`** | `packages/vision` | Vision model providers (Gemini, OpenAI, Mistral, Anthropic) |
| **`@soryos/voice`** | `packages/voice` | Speech-to-text providers (Google, Azure, Whisper) |

---

## 🗄️ 8. Persistence & Real-Time (Honest State)

### Persistence
- **`@soryos/session`** is the single source of truth for `SessionData` (messages, mode, workspace, tool steps, permission grants, todo roadmaps).
- Storage is **in-memory only**: a module-level `Map` on `globalThis.__soryos_sessions_store`. A server restart **LOSES all sessions**. Durable persistence (SQLite or any database) is **NOT implemented** — never claim otherwise.
- There is **no** Firebase, no Convex, no `apps/api`, no FastAPI, no Python backend in this repository. `apps/` contains only the Next.js `web` app. Stale docs mentioning `apps/api/src/soryos-code/db.py`, `data/soryos.db`, or `venv/` are **FALSE**.

### Real-Time
- Streaming is **Next.js SSE routes** (no external service):
  - `apps/web/lib/sse-helper.ts` — SSE helpers (heartbeats, event writes).
  - `apps/web/app/api/sessions/[id]/messages/route.ts` — message/history stream.
  - `apps/web/app/api/sessions/[id]/run/route.ts` — agent run stream (status, text, tool_start, tool_end, error, done).
- `@soryos/bus` (`globalEventBus`) fans out agent/tool events; the run route writes them to the SSE connection the browser subscribes to.

### Background Jobs — NOT IMPLEMENTED
- `@soryos/jobs` (Inngest-style queue) **never compiled** (it imported Convex `_generated` types after Convex was removed) and has been **deleted** along with every doc claim about `soryos/create.session`, `soryos/run.agent`, concurrency limits, and `queue.ts`.
- Long agent runs execute **inline in the SSE run route's request path**, streamed to the client. There is no queued/durable job system.
- If one is ever needed, it must be built for real before any table or diagram may mention it (see Rule §2: NO FAKE EXECUTION).

---


## 🔒 15. Absolute Rules (REITERATED)

1. **NO FAKE IMPLEMENTATIONS**: Every feature claimed must work **REALLY**
2. **NO BLIND COPYING**: Only adapt mechanisms, never copy architecture
3. **RESPECT SORYOS ARCHITECTURE**: Project → Workspace → Session → Environment
4. **ENGINE CORE**: The TypeScript `@soryos/*` suite is the heart of SoryOS (no Rust engine exists here — do not claim one)
5. **MULTI-PROVIDER**: Always support all sandbox providers
6. **SECURITY FIRST**: Ownership verification on all data access
7. **REAL-TIME**: If we claim real-time, it must be **ACTUALLY** real-time
8. **BACKGROUND JOBS**: If we claim background processing, it must **ACTUALLY** run in background

---

## 📜 4. Essential Commands

### TypeScript & Engine Verification:
```bash
# Typecheck all workspaces with 0 errors
npm run typecheck

# Run engine verification suite (5 packages: permissions, provider, tool, execution, agent — 85 tests)
npm run test:engine

# Production build
npm run build

# Start dev server
npm run dev
```

### Autonomous CLI Usage:
```bash
# Help (command tree, flags, exit codes)
npx tsx packages/cli/src/index.ts --help

# Interactive terminal session (REPL: prompt, history, slash commands)
npx tsx packages/cli/src/index.ts interactive
npx tsx packages/cli/src/index.ts i          # alias (also: chat)

# Run a task with the default Build Agent
npx tsx packages/cli/src/index.ts run "<prompt>"

# Run a task with a specific agent role
npx tsx packages/cli/src/index.ts run "<prompt>" --agent plan

# Machine-readable output (NDJSON on stdout)
npx tsx packages/cli/src/index.ts run "<prompt>" --format json

# Session management (real JSON persistence under .soryos/cli-sessions/)
npx tsx packages/cli/src/index.ts session list
npx tsx packages/cli/src/index.ts session export <id>

# Diagnostics
npx tsx packages/cli/src/index.ts auth
npx tsx packages/cli/src/index.ts models
npx tsx packages/cli/src/index.ts debug paths
```

The CLI (`packages/cli`) and the web app (`apps/web`) share the **same engine**: both call
`@soryos/agent`'s `runPipeline()` (which owns session preparation, user message and
`agentRuntime.run()`). The CLI is a thin terminal adapter (stdout = data, stderr = chrome,
exit codes 0/1/130, interactive REPL); the web app is an SSE adapter over the same pipeline.
Details: `packages/cli/AGENTS.md` — roadmap: `docs/plans/cli-gui-shared-interface.md`.

---

## 📝 5. Search & Discovery Protocol Before Modifying

Before making any edit:
1. `SEARCH` -> Run `grep_search` or `glob_files` to locate existing implementations.
2. `READ` -> Read the relevant file using `read_file`.
3. `UNDERSTAND` -> Check the package `AGENTS.md` in that specific folder for domain rules.
4. `REUSE` -> Delegate to official exported utilities in `@soryos/*`.
5. `EXTEND` -> Make surgical, pristine edits.

---

## 📊 6. Recent Implementations & Status

### ✅ Completed (Pushed to GitHub)
- **35 built-in tools** (`@soryos/tool`): including `vision_analyze`, `voice_transcribe`, `image_info` (real disk/model I/O, read-only for plan mode)
- **Enhanced E2B Provider** (`@soryos/sandbox`): Real E2B SDK integration with auto-pause, session tokens, and streaming commands
- **Agent Configuration** (`@soryos/agent`): Runtime with streaming, providers abstraction, and types
- **Plugin System** (`@soryos/plugin`): Promise-based plugin authoring API + loader + real disk storage backend
- **Theme System** (`@soryos/theme`): OKLCH color math + schema + expansion + resolution
- **CLI v2** (`@soryos/cli`): declarative command tree (Spec maison, zero dep) + lazy handlers, `run`/`session`/`models`/`auth`/`debug`/`plugin` commands, NDJSON `--format json`, stdout/stderr discipline, exit codes 0/1/130, real JSON session persistence under `.soryos/cli-sessions/`
- **Interactive CLI REPL** (`soryos-code interactive` / `i` / `chat`, or no args in a TTY): `soryos ›` prompt, 100-entry history (arrows), slash commands (`/help` `/exit` `/new` `/model` `/agent` `/sessions` `/clear`), Ctrl+C/D handling, honest TTY refusal
- **Shared CLI/GUI interface** (all 4 phases done): `runPipeline` in `@soryos/agent`, shared session resolution `resolveSessionTarget` in `@soryos/session`, canonical event contract `SoryOSEvent` in `@soryos/schema`, parity tests + CI guard (no adapter may call `agentRuntime.run()`) — plan: `docs/plans/cli-gui-shared-interface.md`
- **Cleanup**: dead packages (`jobs`, `shared`, `editor`, `platform`, `ui`) and fake providers/placeholders removed; docs corrected to match reality
- **Vibra Code Audit**: Complete documentation in `docs/audit/vibra-code/`

### 🔄 In Progress
- **Durable session persistence**: NOT implemented (in-memory only today) — would replace `@soryos/session`'s Map with a real store
- **Queued background jobs**: NOT implemented — build for real before claiming

### ⏳ Pending
- Mobile app integration

---

## 🎬 7. Vibra Code Integration Summary

### Key Features Adapted from Vibra Code
| Feature | Vibra Code Implementation | SoryOS Implementation | Status |
|---------|---------------------------|----------------------|--------|
| Real-time Sync | Convex subscriptions | Next.js SSE routes + `@soryos/bus` | ✅ Complete (durable DB not implemented) |
| Background Jobs | Inngest queue | None — `@soryos/jobs` deleted (never compiled) | ❌ Not implemented |
| Sandbox Execution | E2B SDK | `@soryos/sandbox` with E2B provider | ✅ Complete |
| Error Recovery | onFailure handler | Error classification system | ✅ Complete |
| Multi-provider | E2B only | E2B, Vercel, Codespaces, Cloud Run | ✅ Already exists |
| Session Management | Convex | `@soryos/session` (in-memory store) | ⚠️ Works in-process; lost on restart |

### Architecture Preservation
- SoryOS hierarchy maintained: Project → Workspace → Session → Environment
- Engine core is the TypeScript `@soryos/*` package suite (no Rust code exists in this repository — any "Rust engine" mention in older docs is stale)
- Multi-provider support preserved
- No duplicate architectures introduced

---

**Last Updated**: October 18, 2026
**Status**: 35 tools ✅ | Plugin ✅ | Theme ✅ | Cleanup ✅ | Durable DB ⏳ | Jobs ⏳

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
