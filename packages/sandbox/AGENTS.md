# `@soryos/sandbox` Agent Operating Guidelines

## Overview
This package provides sandbox execution environments for running code in isolated containers. Supports multiple providers: E2B, Vercel, GitHub Codespaces, and Cloud Run.

## Responsibilities
- Provide `SandboxManager` singleton for managing sandbox instances
- Support `E2BProvider` with real E2B SDK integration
- Manage sandbox lifecycle: create, start, pause, resume, destroy
- Handle filesystem operations within sandboxes
- Execute commands with streaming stdout/stderr
- Configure environment variables and dependencies
- Auto-pause idle sandboxes to reduce costs
- Generate session tokens for secure access

## Key Files
- `src/manager.ts`: `SandboxManager` singleton
- `src/providers/e2b.ts`: E2B provider implementation with auto-pause
- `src/providers/base.ts`: Base sandbox provider interface
- `src/types.ts`: Sandbox types and configurations

## Agent Guidelines
- Always use `SandboxManager` to create and manage sandboxes
- Never bypass sandbox isolation for security-sensitive operations
- Use streaming for command execution to handle large outputs
- Auto-pause sandboxes after 5 minutes of inactivity (configurable)
- Preserve session state across sandbox restarts
- Handle sandbox termination gracefully with error recovery

## E2B Integration
- Uses E2B beta SDK with session tokens
- Supports custom templates via `E2B_TEMPLATE_ID`
- Auto-pause enabled by default (configurable via `autoPause`)
- Timeout configurable (default: 15 minutes)
- Streaming commands with real-time output
- Git operations support within sandbox

## Multi-Provider Support
- **E2B**: Primary cloud sandbox provider
- **Vercel**: Serverless execution environment
- **GitHub Codespaces**: GitHub-native development containers
- **Cloud Run**: Google Cloud managed containers
