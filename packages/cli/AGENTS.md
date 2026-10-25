# `@soryos/cli` — Agent Operating Guidelines

## Overview
The SoryOS-Code CLI is a standalone engine that runs the same **`@soryos/agent` runtime** as the Next.js web app, but in a non-interactive terminal. It shares the exact same code path: session store → agent runtime → tools → execution provider → event bus. There is **no duplicate implementation** — the CLI and the web app both call `@soryos/agent`'s `runPipeline()`.

## Launching

```bash
npm run cli -- <command>              # from the repo root
./node_modules/.bin/soryos-code <cmd>  # workspace binary
soryos-code <command>                  # after `cd packages/cli && npm link`
```

The entry point is `packages/cli/src/index.ts` (shebang `#!/usr/bin/env -S npx tsx`).
`tsx` is a **root devDependency** — the CLI runs TypeScript directly, no build step.

## Architecture

```
CLI (packages/cli/src/index.ts)
  ├── framework/spec.ts       # declarative command tree + lazy handler registry
  ├── framework/ui.ts         # stdout/stderr discipline, NDJSON, exit codes
  ├── framework/flags.ts      # shared flag groups (session, model, format, auto)
  ├── framework/render.ts     # UNIQUE canonical→terminal renderer
  ├── framework/engine.ts     # UNIQUE execution wrapper around @soryos/agent
  ├── framework/interactive.ts# REPL terminal (bordered prompt, history, slash cmds)
  ├── framework/input.ts      # UNIQUE keyboard owner (stdin raw mode) — REPL + pickers
  ├── framework/terminal.ts   # bordered boxes, secret input, interactive picker
  ├── framework/auth.ts       # API key resolution (active provider → disk → env)
  ├── framework/provider-state.ts # active provider (persisted on disk)
  ├── framework/session.ts    # shared session resolution (@soryos/session)
  ├── cli-session-store.ts    # real JSON persistence on disk
  └── commands/
      ├── run.ts              # non-interactive engine (the core)
      ├── interactive.ts      # REPL entry point
      ├── auth.ts             # list / login / logout / switch
      ├── session/{list,delete,export,import}.ts
      ├── models.ts           # @soryos/provider registry
      ├── debug/{paths,config}.ts
      └── plugin.ts           # skill listing
```

### Terminal input (one owner)
`framework/input.ts` is the **single owner of stdin** in raw mode: a stack of key
handlers, the top one receiving the keys. The REPL line editor and the pickers
(`/model`, `/provider`, `auth login`) share it — no conflict on stdin, and
pickers can be opened from inside a running REPL.

The key decoding is done **on the raw bytes** (`decodeKey`), not with
`readline.emitKeypressEvents`: Node's parser does not know the SGR mouse
sequences (`\x1b[<button;col;rowM`) and split them into individual characters.
Our decoder keeps them intact → **tap / click selection works** (tablet,
touchscreen PC).

### Responsive rendering (boxes / cards)
- The box width follows the terminal (`boxWidth()` = `min(cols - 2, 100)`, min 20).
- Every content line is **truncated to the inner width** (`truncateVisible`, ANSI-aware)
  → the right border NEVER drifts, whatever the length of the text.
- Narrow terminals (< 46 inner columns): the descriptions are dropped, the hint
  is shortened, and fewer rows are shown.
- The box is redrawn on `resize` (rotation of a phone).
- The first draw starts at column 0 (the prompt line is cleared), otherwise the
  box would start after the prompt and overflow the screen.
- `drawBox` guarantees: every line of the box has the SAME visible width
  (unit-tested in `packages/cli/__tests__/terminal.test.ts`).

### Touch & mouse support
- `input.enableMouse()` turns on SGR mouse reporting (`?1000h` + `?1006h`).
- A **tap** (press + release on the same line) selects the option under the
  finger; the wheel scrolls the list.
- The pickers query the cursor position (DPR `\x1b[6n`) before drawing, so a
  screen row maps exactly to an option.
- The REPL line editor supports tap-to-position the caret (left/right arrows,
  Home/End, Delete also work).
- Terminals without mouse reporting are unaffected (the events never arrive).

### Interactive mode (REPL)

`soryos-code interactive` (aliases `i`, `chat`) opens a terminal session.
Running `soryos-code` with **no arguments** in a TTY opens it too.

| Feature | Behaviour |
|---------|-----------|
| Prompt | `┃ soryos ›` (left border, like opencode) |
| History | up/down arrows (100 entries) |
| Ctrl+C | clears the current line; on an empty line it exits (code 130) |
| Ctrl+D | exits (code 0) |
| Non-TTY | refused honestly: "Interactive mode requires an interactive terminal (TTY)" |
| Persistence | every turn is written to `.soryos/cli-sessions/<id>.json` |

### Slash commands
| Command | Effect |
|---------|--------|
| `/help`, `/h` | list the slash commands |
| `/exit`, `/quit`, `/q` | leave the session |
| `/new [title]` | start a new session (keeps the same model/agent) |
| `/model [id]` | **picker** over the real model registry (or apply the id directly) |
| `/provider [id]` | **picker** over the AI providers, sets the active one |
| `/agent <role>` | change the agent (`build`/`plan`/`explore`/`code-reviewer`) |
| `/auth` | show the connected provider and the active one |
| `/sessions` | list the 10 most recent sessions |
| `/clear` | clear the screen |

### Provider credentials (`soryos-code auth`)

Adapted from opencode's `auth` family, backed by `@soryos/credentials`:

```bash
soryos-code auth list                 # état de chaque provider (source + connexion)
soryos-code auth login [provider]     # picker + saisie masquée → .soryos/credentials.json
soryos-code auth logout [provider]    # supprime la clé stockée
soryos-code auth switch <provider>    # provider actif (utilisé par défaut)
```

- The key is written to the **global** store `~/.soryos/credentials.json`
  (mode **0600**) so it works from any directory; a project file
  `.soryos/credentials.json` can override it.
- `auth logout` removes the key from both scopes.
- `framework/auth.ts#resolveProviderContext` resolves:
  **active provider → disk → env vars**.
- The **active provider makes authority**: if it has no key, the CLI fails
  honestly (`Provider "X" is active but has no API key`) instead of silently
  using another provider.
- The **model follows the provider**: the session model defaults to the
  provider's default model, and switching provider in the REPL switches the
  model too (a Gemini model with an OpenAI provider always fails).
- The stored key is REALLY used: `@soryos/credentials` hydrates the store at
  startup, and the providers resolve their key through it.
- `opencode-zen` has a public default (by design) — it shows as connected.

### Shared engine (single source of truth)
- `@soryos/agent` exposes `runPipeline(options, emit)` — the **only** place that
  prepares a session, appends the user message, and calls `agentRuntime.run()`.
  It emits **canonical events only** (`SoryOSEvent`, translated from the planner
  stream and the bus by `toSoryOSEvent()` in `@soryos/schema`).
- `framework/engine.ts#executeRun` is the **only** CLI call site of `runPipeline`.
- `framework/render.ts#createRenderer` is the **only** canonical→terminal renderer
  (used by both `run` and `interactive` — no duplicated switch statements).
- `framework/interactions.ts#handleInteraction` answers the permission/question
  requests (canonical events) — the CLI never hangs waiting for a human.
- `framework/session.ts#resolveCliSession` is the **only** CLI session resolution
  (it wraps the shared `@soryos/session` `resolveSessionTarget`).
- The web app calls the same `runPipeline` (`apps/web/app/api/sessions/[id]/messages/route.ts`
  and `.../run/route.ts`) and the same `resolveSessionTarget`
  (`.../run/route.ts` with `{ target: "continue" | "fork" }`).

## Output Conventions (opencode-style, adapted)
- **stdout = DATA only** (NDJSON `--format json`, lists, exports)
- **stderr = chrome** (progress, errors, human rendering)
- **Exit codes**: `0` ok · `1` error · `130` SIGINT (user interrupt)
- **`--format json`** → NDJSON events with `{type, timestamp, sessionId, ...}` envelope
- **`--help`/`-h`** → help on stdout, exit 0

## Commands

| Command | Subcommands | Purpose |
|---------|-------------|---------|
| `run` | — | Non-interactive single prompt (the core) |
| `interactive` (`i`, `chat`) | — | Terminal REPL session (prompt, history, slash commands) |
| `session` | `list`, `delete`, `export`, `import` | Disk-backed session management |
| `models` | — | List available models from `@soryos/provider` |
| `auth` | — | Detect API keys by provider (env vars) |
| `debug` | `paths`, `config` | Diagnostic info |
| `plugin` | — | List available skills (`packages/tool/skills/*.md`) |
| `help` | — | Show help |

## `run` / `interactive` Flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--session` | `-s` | Session id (created if missing) |
| `--continue` | `-c` | Resume the most recent session |
| `--fork` | — | Fork a copy of the target session |
| `--model` | `-m` | Model id (e.g. `gemini-2.5-flash`) |
| `--agent` | — | Agent role: `build` \| `plan` \| `explore` \| `code-reviewer` |
| `--format` | — | `default` \| `json` |
| `--auto` | — | Auto-approve permission prompts |
| `--title` | — | Session title |

## Session Persistence

Sessions are stored as JSON files under `.soryos/cli-sessions/` (one file per session). This is **real disk I/O** — not in-memory only. Sessions persist across CLI invocations.

- `session list` shows all sessions on disk
- `session export <id>` dumps a session as JSON
- `session import <file>` restores a session from JSON
- `--continue` resumes the most recent session
- `--fork` clones a session with a new id

The `.soryos/` directory is **gitignored** (local state, not source).

### Contracts to respect (do not violate)
- `@soryos/session`: always call `sessionStore.getOrCreate(id)` **before** `sessionStore.save(session)` — `save()` throws if the id is unknown to the in-memory store.
- `@soryos/session`: session resolution goes through `resolveSessionTarget()` (shared with the GUI) — never re-implement `--session`/`--continue`/`--fork` in the CLI.
- `@soryos/session`: `SessionSource.persist()` is **awaited** — never fire-and-forget a write, a concurrent write would lose the final state.
- `@soryos/workspace`: the agent runtime requires a workspace for the session. The CLI creates a **local** workspace rooted at `process.cwd()` (a terminal agent works in the current project), via `workspaceManager.getOrCreateWorkspace(session.id, { environment: "local", providerId: "local", workspacePath: process.cwd() })`.
- `@soryos/bus`: the CLI subscribes to `globalEventBus.on("*")` and filters by `sessionId` (see `framework/render.ts`).
- The session is persisted on **success AND failure** — a failed run must never lose the user message.
- Never rewrite the whole session object from a stale local copy (`sessionStore.save(localCopy)` drops the history) — use `sessionStore.update(id, { field })`.

## Shared Engine with the Web App

The CLI and the web app share the **exact same runtime path**:

```
CLI run/interactive → @soryos/agent (runPipeline) → @soryos/tool → @soryos/execution → @soryos/bus → events
Web run/messages    → @soryos/agent (runPipeline) → @soryos/tool → @soryos/execution → @soryos/bus → SSE routes
```

Both call `runPipeline()` from `@soryos/agent`, which owns:
session preparation → user message append → `agentRuntime.run()` → honest failure.
The only difference is the **event sink**: the web app streams events via SSE routes
(`apps/web/app/api/sessions/[id]/run/route.ts`), while the CLI renders them to
stderr/stdout through `framework/render.ts`.

### Roadmap
See `docs/plans/cli-gui-shared-interface.md`:
- Phase 0 (CLI v2) ✅ · Phase 1 (`runPipeline` extracted) ✅
- Phase 2 (shared session resolution `--session/--continue/--fork`) ⏳
- Phase 3 (canonical event contract + questions/permissions parity) ⏳
- Phase 4 (parity test harness + CI grep guard) ⏳

## Dependencies
- `@soryos/agent`, `@soryos/bus`, `@soryos/core`, `@soryos/execution`, `@soryos/permissions`, `@soryos/schema`, `@soryos/session`, `@soryos/tool`

## Testing
- `npm run typecheck` — must pass with 0 errors
- `npm run test:engine` — engine test suite
- Manual smoke:
  ```bash
  npx tsx packages/cli/src/index.ts --help
  npx tsx packages/cli/src/index.ts auth
  npx tsx packages/cli/src/index.ts session list
  npx tsx packages/cli/src/index.ts run "hello"   # exit 1 (honest) if no API key
  ```

## Agent Guidelines
- **NO FAKE EXECUTION**: every command must perform real disk/model I/O
- **NO DUPLICATE IMPLEMENTATIONS**: the CLI must reuse `@soryos/agent`, not reimplement the runtime
- **stdout/stderr discipline**: data on stdout, chrome on stderr
- **Exit codes**: 0/1/130 as documented
- **Real persistence**: sessions are written to disk, not mocked