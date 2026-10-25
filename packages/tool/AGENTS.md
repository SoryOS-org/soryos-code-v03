# `@soryos/tool` Agent Operating Guidelines

## Overview
This package houses the **`ToolRegistry`** and **`ToolExecutor`** responsible for executing all file operations, shell commands, and searches.

## Responsibilities
- Register tool definitions with Gemini-compatible schemas.
- Validate tool parameters against Zod/JSON schemas.
- Delegate execution to the active `ExecutionProvider`.
- Enforce the invariant: *"NO REAL ACTION = NO SUCCESS"*. Every tool MUST perform physical disk/shell actions and verify results.

## Registered Tools (35 + dynamic MCP)
- `read_file`: Reads file content with 1-based line numbers.
- `write_file`: Overwrites/creates pristine files on disk.
- `edit_file`: Multi-tier matching (see below).
- `delete_file`: Safely deletes a file from disk.
- `shell_command`: Executes bash commands with a 60s timeout; supports `background` mode.
- `glob_files`: Matches files using glob patterns; supports `hidden` and `limit`.
- `grep_search`: Searches regex or text patterns across files (ripgrep fast path, supports `include` glob filter).
- `list_files`: Recursively lists directories and files.
- `git_status`, `git_diff`, `git_log`, `git_add`, `git_commit`: Git operations.
- `git_worktree_create`, `git_worktree_list`, `git_worktree_remove`: Isolated git worktrees (see below).
- `codemode`: Executes a JS program chaining many tool calls in one step (see below).
- `codebase_search`: Semantic search over the codebase.
- `todo_write` & `todo_read`: Manages task roadmaps.
- `webfetch`: Fetches an http(s) URL and returns status, headers and body; supports `format` (text|html).
- `websearch`: Searches the web via DuckDuckGo for current information (see below).
- `file_diff`: Computes a unified diff between two file contents (see below).
- `skill`: Loads specialized skill instructions (see below).
- `list_mcp_resources`: Lists resources exposed by MCP servers (see below).
- `read_mcp_resource`: Reads an MCP resource by server and URI (see below).
- `session_rename`: Renames a session (optional `sessionID`) (see below).
- `session_move`: Moves a session to another directory (optional `sessionID`).
- `models`: Searches available AI models with paging (`all`, `limit`, `offset`) (see below).
- `session_info`: Gets information about the current session (see below).
- `patch_file`: Applies a multi-file OpenCode-format patch (see below).
- `question`: Asks the user interactive questions mid-run (see below).
- `vision_analyze`: Analyzes an image with a real vision model (see below).
- `voice_transcribe`: Transcribes an audio file from disk to text (see below).
- `image_info`: Reads real image metadata from disk/URL (see below).
- **MCP tools**: every connected MCP server contributes `mcp_<server>__<tool>` tools dynamically (see below).

## `patch_file` (`src/patch-tools.ts`)
Port of OpenCode's patch language: `*** Begin Patch` / `*** End Patch` envelope with `*** Add File:` (lines prefixed `+`), `*** Delete File:`, `*** Update File:` (optional `*** Move to:`, `@@` context chunks with ` `/`-`/`+` lines, `*** End of File` anchor). Parser + `deriveUpdate` are pure (`parsePatch`, `deriveUpdate` exported). Apply flow = prepare ALL hunks in memory (verify reads + context matches, 4-tier seek: exact→rstrip→trim→unicode-normalized) BEFORE any write; then sequential apply with physical re-read verification; honest partial-failure errors (`Completed before failure: …`).

## `question` (`src/question-tools.ts`)
Interactive ask (port of OpenCode's question tool): tool emits `question.asked` with a requestId + questions; UI/route answers via `resolveQuestionRequest(requestId, answers)` (or `cancelQuestionRequest`). 120s timeout → cancelled with an honest dismissal message. Free-form answer is implicit; planner prompt guides "(Recommended)" first-option convention. Web route: `POST /api/sessions/[id]/questions` (thin pass-through).

## `edit_file` Matching Strategy (`src/edit-matcher.ts`)
Port of OpenCode's edit strategy. `applyEdit(source, oldString, newString, replaceAll)` tries, in order:
1. **Exact bytes** match of `oldString` (LF view; CRLF preserved in the replacement region).
2. **Normalized match**: smart quotes (`'’‚‛` → `'`, `"”„‟` → `"`), dashes (`‐‑‒–—―−` → `-`), unicode spaces (`\u00A0\u2002-\u200A\u202F\u205F\u3000` → ` `). Uniqueness is required.
3. **Line-based match**: each line of `oldString` trimmed of trailing whitespace (tolerates indentation drift).

Uniqueness is STRICT: 0 matches → `Could not find the target…` with candidate lines; N>1 → `Found N matches…` with line numbers (agent must add context or set `allOccurrences`).
Canonical params: `path`, `targetContent`, `replacementContent`, `allOccurrences`.
ALIASES kept: `old_string`/`new_string`/`replace_all` (planner prompt compatibility).

## `webfetch` (`src/web-tools.ts`)
`WebFetchTool.fetchPage(url, {method?, body?})`: http/https only, 15s AbortController timeout, `User-Agent: SoryOS-Agent/1.0`, body truncated at 20 000 chars (`[truncated after 20000 characters]`), HTML → plain text via `stripHtml`. Emits `tool.started/completed/failed` on the bus.

## `websearch` (`src/websearch-tools.ts`)
`WebSearchTool.search(query)`: Real web search via DuckDuckGo HTML endpoint (no API key required). 15s AbortController timeout, User-Agent mimics Chrome. Parses result blocks (title, URL with uddg redirect decoding, snippet). Max 10 results, snippets truncated at 300 chars. Emits `tool.started/completed/failed` on the bus. Returns honest "No search results found" when zero matches.

## `file_diff` (`src/file-diff-tools.ts`)
`FileDiffTool.diffContents(file, before, after, status?)`: Computes unified diff between two file contents using the `diff` library. Returns patch with additions/deletions counts. Status defaults to "modified" (can be "added" or "deleted"). Patch truncated at 50 000 chars. Emits `tool.started/completed/failed` on the bus. Exported pure function `computeFileDiff` for direct use.

## `skill` (`src/skill-tools.ts`)
`SkillTool.loadSkill(id)`: Loads specialized skill instructions into the conversation from REAL markdown files on disk (`packages/tool/skills/<id>.md`). Built-in registry: typescript-expert, react-specialist, api-design, testing-strategy, security-audit. `resolveSkillFile()` tries module-relative (`import.meta.url` → `../skills`), then cwd candidates (`packages/tool/skills`, `skills`); empty/missing file → honest error listing the tried paths (never placeholder text). Exports `listSkills()`, `searchSkills(query)`, `skillDirectoryCandidates()`, `resolveSkillFile()`. Emits `tool.started/completed/failed` on the bus. Tests: `__tests__/skills.test.ts`.

## `list_mcp_resources` & `read_mcp_resource` (`src/mcp-resource-tools.ts`)
`McpResourceTools.listResources(server?)`: Lists resources and templates from one or all connected MCP servers. `McpResourceTools.readResource(server, uri)`: Reads a resource by server and URI. Content truncated at 50 000 chars. Uses `mcpManager.listServerResources/listAllResources/readServerResource`. Emits `tool.started/completed/failed` on the bus.

## `session_rename`, `session_move`, `models`, `session_info` (`src/opencode-tools.ts`)
`OpenCodeTools.renameSession(sessionId, title)`: Renames a session via sessionStore. `OpenCodeTools.moveSession(sessionId, directory)`: Moves a session to another directory (validates existence + isDirectory, supports ~). `OpenCodeTools.listModels(query?, provider?, opts?)`: Searches built-in model registry with paging (`all`, `limit`, `offset`); returns `{ models, total }`. `OpenCodeTools.getSessionInfo(sessionId)`: Returns session metadata. Emits `tool.started/completed/failed` on the bus. Exported pure function `searchModels`.

## `vision_analyze` (`src/vision-tools.ts`)
`VisionTools.analyze({image, analysisType?, prompt?, provider?})`: Real image analysis via `@soryos/vision` (Gemini, OpenAI, Mistral, Anthropic). Physical I/O: local files read byte-by-byte from disk (20MB cap, magic-byte format check via `@soryos/images readImageInfo` → data URL), http(s)/data URLs passed through (provider fetches). Provider resolution `resolveVisionProvider()`: explicit → validates API key env var (`GEMINI_API_KEY`/`OPENAI_API_KEY`/`MISTRAL_API_KEY`/`ANTHROPIC_API_KEY`); auto-detect from env keys; NO FAKE: provider `local` is rejected honestly (it is a hardcoded placeholder). Pre-flight `isAvailable()` check before any network call; 130s timeout with cleared timer; empty provider response → honest error. analysisType `custom` requires a prompt. Aliases: `image` ← path/file/imageUrl/src. Category `web`, **read-only** (allowed in plan/explore). Emits bus events.

## `voice_transcribe` (`src/voice-tools.ts`)
`VoiceTools.transcribe({path, provider?, language?})`: Real speech-to-text for audio FILES on disk via `@soryos/voice`. Physical I/O: file stat + read (25MB cap, empty-file check), format inferred from extension (wav/mp3/ogg/opus/webm/pcm). `resolveVoiceProvider()`: auto-detect google (`GOOGLE_SPEECH_API_KEY`/`GOOGLE_API_KEY`) → azure (`AZURE_SPEECH_KEY`) → whisper (`WHISPER_ENDPOINT`, default `http://localhost:8000/whisper`); browser-only `web-speech-api` rejected honestly (no microphone in a server process); `aws` rejected honestly (S3 integration not implemented). Live env lookup + `TranscriberFactory.clearInstances()` retry so a cached instance never keeps a stale/missing key. 120s timeout; empty transcript → honest error. Category `web`, **read-only**. Emits bus events.

## `image_info` (`src/image-tools.ts`)
`ImageTools.info({path})`: Real image metadata (format, MIME, pixel dimensions, size, alpha) via `@soryos/images readImageInfo` — zero-dependency magic-byte + header parsing (PNG IHDR, JPEG SOF walk, GIF, WebP VP8/VP8L/VP8X, BMP; svg/tiff recognised without dimensions). Physical I/O: local file read (50MB cap) or http(s) fetch (20s timeout, content-length pre-check). Unrecognised bytes → honest "not a recognised image format" (never guesses). Category `filesystem`, **read-only**. Emits bus events.

## Interactive "Ask" Gate (`ToolExecutor.askGateDangerousTool`)
For `DANGEROUS_TOOLS` (`shell_command`, `delete_file`, `git_commit`) in build mode, when `SessionData.confirmDangerous === true` and no persistent grant exists, the executor emits `permission.requested` and waits on `createPermissionRequest()` (30s timeout → deny-once). Decisions `allow-always`/`deny-always` persist in `SessionData.permissionGrants`. Default (confirmDangerous off) = full autonomous access per AGENTS.md. Depends on `@soryos/session` (cycle-safe) for grant persistence.

## Codemode (`src/codemode-tools.ts`)
Port of OpenCode's codemode: the model writes ONE JavaScript program that chains many tool calls in a single step. Executed in a restricted `node:vm` context (`codeGeneration` disabled) exposing ONLY `tools` (Proxy → real `ToolExecutor.execute` per call, permissions/ask-gate enforced per mode) and a `console` capture — no require/process/fs/fetch. Script runs as an async IIFE; sync prefix bounded by vm timeout (≤5s), async remainder by wall-clock race (default 30s, max 120s, honest timeout message noting in-flight side effects already happened). Final expression/return value = tool output (strings, JSON for objects, logs when undefined). `HandlerContext` carries `mode` + `executor` for dispatch. Denied in plan/explore (not read-only). Planner prompt guides codemode for deterministic multi-step sequences.

## Git Worktrees (`src/worktree-tools.ts`)
`WorktreeTools` runs REAL `git worktree add/list/remove --porcelain` through the ExecutionProvider shell. Worktrees live under `<repoRoot>/.soryos-worktrees/<name>` on branch `soryos/<name>` (gitignored). Names are sanitized (no path traversal, `/` stripped); branch names may contain `/` but never `..`. Create verifies the directory + `.git` link physically (`verified: true`). Registry tools: `git_worktree_create`, `git_worktree_list`, `git_worktree_remove` (category `git`, denied in plan/explore). Used by `@soryos/agent` for subagent isolation (`task {isolate:true}`) — the worktree is KEPT and reported, never silently discarded.

## `grep_search` Ripgrep Fast Path (`src/ripgrep.ts`)
When the ExecutionProvider is `type: "local"` and a real `rg` binary is on PATH (cached detection via `isRipgrepAvailable()`), `grepSearch` runs ripgrep (`buildRgArgs`: `-F`/`-i`/`--line-number`, excludes node_modules/.git/dist…) and parses `path:line:content`. On rg exit 2 or crash it falls back to the portable recursive scan over `provider.listFiles` (flat recursive listing). `resetRipgrepCache()` for tests. Metadata tags `engine: "ripgrep"`.

## MCP (Model Context Protocol) (`src/mcp-client.ts`, `src/mcp-manager.ts`)
Port of OpenCode's MCP design on the official `@modelcontextprotocol/sdk`. Sessions declare servers in `SessionData.mcpServers` (`McpServerConfig`: `local` stdio command/args/env/cwd or `remote` Streamable HTTP url/headers). `mcpManager.ensureConnected(session)` is called at planner start; failures never block the run (honest `failed` status + `mcp.server.failed` bus event). Connected tools are registered as `mcp_<san(server)>__<san(tool)>` (category `mcp`, inputSchema passthrough normalized with empty `required`); handlers call `connection.callTool` (execution timeout 60s default) and map text parts joined, media parts described as `[media content: mime, ~N bytes base64 elided]` (never inlined). `isError` from the server → honest error result. Permissions: default deny outside build mode (plan/explore/code-reviewer refuse unknown MCP tools). One connection per server name, process-global; `disconnectServer` removes tools + handler overrides. Bus: `mcp.server.connected/failed/disconnected`, `mcp.tools.registered`. Web route: `POST/GET /api/sessions/[id]/mcp` (thin pass-through). OAuth not supported yet (remote = static headers only).

## Agent Guidelines
- When adding a new tool, declare its schema in `ToolRegistry` and add its execution handler in `ToolExecutor`.
- Never fake tool execution results. Return real stdout, stderr, or filesystem outputs.
- Tools that need runtime/context (LLM, subagents) are INJECTED via `toolRegistry.add()` + `ToolExecutor.registerHandler()` (static override map) from the owning package — never import `@soryos/agent` from here (dependency cycle).
