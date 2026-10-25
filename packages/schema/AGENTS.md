# `@soryos/schema` Agent Operating Guidelines

## Overview
This package is the **source of truth for all domain types, contracts, and interfaces** in SoryOS-Code.

## Key Types
- `ActiveWorkspace`, `WorkspaceStatus`, `ProviderId`
- `SessionData`, `MessageBlock`, `ToolStep`
- `AgentEventPayload`, `ToolDefinition`, `ToolExecutionResult`
- `SoryOSEvent` (canonical event contract — see below)

## Canonical Event Contract (`src/events.ts`)

`SoryOSEvent` is the **single vocabulary** shared by every adapter (CLI terminal,
web SSE, NDJSON). `toSoryOSEvent(raw)` translates the two historical vocabularies
into it:

| Source | Raw type | Canonical type |
|--------|----------|----------------|
| planner | `status` | `status` |
| planner | `text` | `text` |
| planner | `tool_start` | `tool_use` |
| planner | `tool_end` | `tool_end` |
| planner | `files_changed` | `file_changed` |
| planner | `error` | `error` |
| planner | `done` | *(ignored — see below)* |
| bus | `agent.started` | `status` |
| bus | `agent.completed` | `done` |
| bus | `agent.failed` | `error` |
| bus | `permission.requested` | `permission_requested` |
| bus | `question.asked` | `question_asked` |
| bus | `file.changed` | `file_changed` |
| bus | `tool.started/completed/failed` | *(ignored — duplicates `tool_use`/`tool_end`)* |

> The planner's `done` means "this LLM turn is over"; the canonical `done` means
> "the run is over" (bus `agent.completed`). They are deliberately distinct.

## Agent Guidelines
- All shared domain interfaces MUST be defined in `packages/schema/src/index.ts`
  (or a focused module re-exported from it, like `src/events.ts`).
- Never create duplicate type definitions in `apps/web/` or individual packages.
- Never invent a new event vocabulary in an adapter: extend `SoryOSEvent` and its
  translator instead.
- This package is **pure types + pure functions**: no I/O, no runtime deps.

## Testing
- `npx vitest run` in this package (wired into `npm run test:engine` at the root).
- `packages/schema/__tests__/events.test.ts` covers the translation rules.
