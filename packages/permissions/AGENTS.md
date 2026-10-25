# `@soryos/permissions` Agent Operating Guidelines

## Overview
This package manages granular role-based security policies (`PermissionsManager`) and the interactive "ask" flow.

## Roles & Policies
- **`build`**: Full read, write, and shell execution access (full autonomous by default).
- **`plan`**: Read-only access. Write and shell execution calls are blocked and throw `PermissionDeniedError`.
- **`explore`**: Read, glob, and grep search access.
- **`code-reviewer`**: Read and test suite execution access.

## Interactive "Ask" Flow (OpenCode-style)
- `DANGEROUS_TOOLS`: `shell_command`, `delete_file`, `git_commit`.
- Active ONLY in `build` mode when `SessionData.confirmDangerous === true` (build stays full-access by default per AGENTS.md).
- `createPermissionRequest(sessionId, toolName, args, timeoutMs=30000)` → `{requestId, decision}`. The caller (ToolExecutor) emits a `permission.requested` bus event; a UI/route answers via `resolvePermissionRequest(requestId, decision)`.
- Decisions: `allow-once`, `allow-always`, `deny-once`, `deny-always`. Timeout → `deny-once` (safe default, never hangs forever).
- `allow-always`/`deny-always` persist into `SessionData.permissionGrants` (per-session, per-tool).
- Web route: `POST /api/sessions/[id]/permissions` (thin pass-through in apps/web).

## Agent Guidelines
- Always call `permissionsManager.validatePermission(agentRole, actionType, pathOrCommand)` before executing tools.
