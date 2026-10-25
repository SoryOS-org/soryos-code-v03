# `@soryos/credentials` Agent Operating Guidelines

## Overview
Credential management for AI providers: **who is connected, with which key, from where**.

## Responsibilities
- Declare the known providers and their fields (`PROVIDER_REGISTRY`).
- Resolve the effective credential for a provider, following a strict priority.
- Persist the keys on **disk** (real I/O) so they survive a restart.
- Report the status of each provider (configured / source / fingerprint / masked key).

## Resolution priority (`resolveCredentials`)
1. **Session override** — per-session credentials (UI)
2. **Project store** — the in-memory store, hydrated from disk
3. **Environment variable** — `GEMINI_API_KEY`, `OPENAI_API_KEY`, …
4. **Public default** — only `opencode-zen` (`Bearer public`)
5. **Unconfigured**

`setCredentialResolver()` is installed at import time, so every provider in
`@soryos/provider` picks up the stored key automatically.

## Disk persistence (`src/store.ts`)
- Project scope: `<cwd>/.soryos/credentials.json`
- Global scope: `~/.soryos/credentials.json` (project wins over global)
- Written **atomically** (tmp file + rename) with mode **0600** (the file holds secrets)
- `credentialManager.hydrate()` loads the disk into the in-memory store at startup
- `credentialManager.persist()` / `.remove()` write and delete on disk

> The in-memory store alone is lost on restart: **always** call `hydrate()` at
> process start (the CLI does it in `runCLI`).

## Agent Guidelines
- Never log a key: use `maskSecret()` / `fingerprint` for display.
- Never store a key outside `store.ts` (single owner of the file format).
- A provider is "connected" only if `resolveCredentials().isConfigured` is true.
- The CLI's `auth` command family (`list` / `login` / `logout` / `switch`) is the
  user-facing surface; the web app has its own settings UI over the same manager.

## Testing
- `npx vitest run` in this package (wired into `npm run test:engine` at the root).
- `packages/credentials/__tests__/store.test.ts` covers the disk behaviour.
