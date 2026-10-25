# `@soryos/execution` Agent Operating Guidelines

## Overview
This package provides the physical execution provider layer (`ExecutionProvider`, `LocalExecutionProvider`, `ExecutionManager`).

## Responsibilities
- Execute shell commands, file reads, writes, edits, and directory scans.
- Provide cross-environment execution abstractions (Local, Codespaces, E2B, Vercel, Cloud Run).
- Ensure browser-safe dynamic evaluation (`eval("require")`) so Next.js client bundlers do not fail on Node native modules (`child_process`, `fs/promises`, `path`).

## Key Classes
- `LocalExecutionProvider`: Implements `ExecutionProvider` for local filesystem and process execution.
- `ExecutionManager`: Manages instances per session (`executionManager`).

## Agent Guidelines
- Never import top-level static `child_process` or `fs/promises` directly in files that can be bundled into client builds.
- Always verify path bounds against `workspaceDir`.
