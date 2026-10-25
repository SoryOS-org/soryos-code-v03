# `@soryos/workspace` Agent Operating Guidelines

## Overview
This package is the source of truth for `ActiveWorkspace` state, shared synchronously between Explorer, Editor, Terminal, Agent, and DevRunner.

## Responsibilities
- Manage active workspaces (`WorkspaceManager`, `workspaceManager`).
- Resolve active workspace directory paths (`workspacePath`).
- Ensure local sessions point to `process.cwd()` (`/app/applet`).

## Agent Guidelines
- Never create a parallel workspace state in `apps/web/`.
- Always query `workspaceManager.getOrCreateWorkspace(sessionId)`.
