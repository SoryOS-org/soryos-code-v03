# `@soryos/agent` Agent Operating Guidelines

## Overview
This package houses the core autonomous **`AgentRuntime`** and agent matrix (`build`, `plan`, `explore`, `code-reviewer`).

## Responsibilities
- Drive multi-turn inference loops with LLMs.
- Parse tool calls and delegate to `@soryos/tool`.
- Enforce role permissions via `@soryos/permissions`.
- Stream real-time events (`agent.started`, `agent.completed`, `agent.failed`) over `@soryos/bus`.
- Handle errors with comprehensive classification and recovery via `ErrorRecoveryManager`.

## Key Files
- `src/index.ts`: Primary export point for `AgentRuntime`, `agentRuntime`, and agent matrix configuration. Calls `registerTaskTool()` on import (injects the `task` tool into the global registry + executor override).
- `src/runtime.ts`: Core agent execution engine; per-session run lock, `agent.started/completed/failed` emitted on `@soryos/bus`.
- `src/planner.ts`: Plan → execute → feedback loop (auto-correction, pause/cancellation, honest failure persistence). Passes the triggering user message's `images` (vision input) to the LLM in `createPlan` and in the feedback re-prompt.
- `src/llm-client.ts`: Single LLM entry point on `@soryos/provider` with UI credential resolution. `generate/streamChat` accept optional `images` (base64 attachments) threaded onto the user message for multimodal providers.
- `src/prompts.ts`: Planner and feedback system prompts (includes delegation guidance for the `task` tool).
- `src/error-handler.ts`: Error classification and recovery system with 10+ error types (`classifyError` wired in `planner.ts`).
- `src/config.ts`: Agent configuration and matrix definitions.
- `src/providers.ts`: AI provider abstraction.
- `src/types.ts`: Type definitions.

## Memory & Context (`src/session-compactor.ts`, `src/context-builder.ts`)
- `SessionCompactor.maybeCompact(sessionId)`: when `messages.length > 30` (COMPACTION_THRESHOLD), the OLDER messages are summarized by the LLM into a structured `SessionData.memorySummary` (merged across compactions, capped 12k chars); the last 15 (KEEP_RECENT_MESSAGES) stay verbatim. NEVER deletes without a summary — LLM failure = messages untouched + honest error. Emits `session.compacted`. Wired at the start of `Planner.planAndExecute`; the planner prompt prepends `Earlier conversation (compacted memory)`.
- `ContextBuilder.buildContext`: user_request + project instruction files (`AGENTS.md`, `CONVENTIONS.md`, `README.md` from the workspace root, 4k chars each) + shallow tree overview (depth 2, skips node_modules/.git/dist…, max 60 entries) + open files + active file; capped at 20 items.

## Subagent System (`src/subagents.ts`)
- `explore` (mode `explore`, read-only, 12 tool calls), `plan` (mode `plan`, read-only + webfetch, 10), `coder` (mode `build`, full, 15).
- `SubagentManager.run()` = REAL loop: LLM replies with `{"toolCalls":[...],"final":null}` → tools executed through the real `ToolExecutor` (permissions enforced per subagent mode) → until final answer, tool-call limit (honest PARTIAL result), pause, or LLM error.
- **Worktree isolation** (`run({ isolate: true })` / `task {isolate:true}`): on local providers, a real git worktree is created via `WorktreeTools` (`@soryos/tool`), all tool calls run through a `LocalExecutionProvider` rooted at the worktree, and the worktree is KEPT + reported in `SubagentRunResult.worktreePath/worktreeBranch` (never silently discarded; main checkout untouched). Non-local providers or git failures → honest isolation note, run continues in the main workspace.
- The `task` tool (`{subagent, prompt, isolate?}`) is INJECTED from this package into `@soryos/tool` (registry + static override map) — `@soryos/tool` never imports `@soryos/agent` (no cycle). Denied in plan/explore/code-reviewer modes by default permissions.
- Bus events: `subagent.started`, `subagent.completed`, `subagent.failed`.

## Agent Guidelines
- Never bypass `@soryos/permissions`.
- If an agent role is `plan` or `explore`, writes and shell commands MUST be blocked.
- Always handle LLM API errors gracefully and report exact failure causes.
- Use `ErrorRecoveryManager` for error classification and recovery.
- Always preserve session state on errors when appropriate.
- Provide user-friendly error messages with recovery suggestions.

## Error Handling
The package includes a comprehensive error recovery system inspired by Vibra Code's onFailure handler:

### Error Types (10+ classified types)
- **timeout**: Operation took too long (retryable)
- **sandbox_terminated**: Sandbox was terminated (retryable)
- **sandbox_not_ready**: Sandbox still initializing (retryable)
- **network_error**: Network connectivity issues (retryable)
- **rate_limit**: API rate limit exceeded (retryable)
- **permission_denied**: Insufficient permissions (not retryable)
- **invalid_input**: Invalid parameters (not retryable)
- **resource_exhausted**: Out of resources (not retryable)
- **internal_error**: Internal system errors (retryable)
- **validation_error**: Schema validation failed (not retryable)
- **canceled**: Operation was canceled (not retryable)
- **session_expired**: Session has expired (not retryable)
- **git_error**: Git operations failed (not retryable)
- **build_failed**: Build process failed (not retryable)

### Error Recovery Features
- **Automatic Classification**: Errors are automatically classified based on message patterns
- **Retry Logic**: Exponential backoff for retryable errors (base 100ms, max 30s)
- **Session Preservation**: Session state is preserved for recoverable errors
- **User Notifications**: User-friendly messages with recovery suggestions
- **Event Streaming**: Error events streamed via `@soryos/bus`
- **Custom Error Classes**: Type-safe error handling with dedicated classes
